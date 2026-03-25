import { MatchEngine, type MatchConfig, type BotConnection, type MarketTick } from '../engine/match';
import { eloToTier } from '../engine/scoring';
import { templateBotRunner } from './templateBots';
import { houseBotService } from './houseBots';
import { MarketRecorder } from './marketRecorder';
import { config } from '../lib/config';
import prisma from '../lib/prisma';
import crypto from 'crypto';

/**
 * Async Match Service
 *
 * The key to making head-to-head work:
 *   1. Record real market data during trading hours
 *   2. Player A plays against that data → gets a score
 *   3. Player B plays the SAME data → gets a score
 *   4. Compare scores → winner determined
 *
 * Benefits:
 *   - No scheduling needed — play when you want
 *   - Fair — exact same market conditions
 *   - Works off-hours — replay recorded data
 *   - Enables challenges — "beat my score on this data"
 */

interface AsyncMatchResult {
  matchId: string;
  chunkId: string;
  botId: string;
  userId: string;
  score: any; // ScoreBreakdown
  completedAt: Date;
}

export class AsyncMatchService {
  /**
   * Start an async match — bot plays against recorded market data.
   * Returns the score immediately (match runs at accelerated speed).
   */
  async playAsync(
    botId: string,
    chunkId?: string,
    sessionType?: string,
  ): Promise<{
    matchId: string;
    score: any;
    error?: string;
  }> {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return { matchId: '', score: null, error: 'Bot not found' };

    // Get market data chunk
    let chunk;
    if (chunkId) {
      const dbChunk = await prisma.marketChunk.findUnique({ where: { id: chunkId } });
      if (!dbChunk) return { matchId: '', score: null, error: 'Market data not found' };
      chunk = {
        id: dbChunk.id,
        symbols: JSON.parse(dbChunk.symbols),
        ticks: JSON.parse(dbChunk.tickData) as MarketTick[],
        sessionType: dbChunk.sessionType,
      };
    } else {
      chunk = await MarketRecorder.getRandomChunk(sessionType || 'MARKET_HOURS');
      if (!chunk) {
        // No recorded data — generate synthetic
        chunk = this.generateSyntheticChunk();
      }
    }

    // Create match engine (bot vs phantom — we only care about bot's score)
    const matchId = crypto.randomBytes(12).toString('hex');
    const duration = Math.min(chunk.ticks.length, 300); // Max 5 min

    const matchConfig: MatchConfig = {
      matchId,
      mode: 'ASYNC',
      format: 'LADDER',
      duration,
      symbols: chunk.symbols,
      startingCapital: config.match.startingCapital,
      maxPositionPct: config.match.maxPositionPct,
      maxOpenPositions: config.match.maxOpenPositions,
      minTradeInterval: config.match.minTradeInterval,
      tier: eloToTier(bot.elo),
    };

    const botConn: BotConnection = {
      botId: bot.id,
      userId: bot.userId,
      apiKey: bot.apiKey,
      elo: bot.elo,
      ws: null,
    };

    // Phantom bot (does nothing — just a placeholder)
    const phantomConn: BotConnection = {
      botId: 'phantom',
      userId: 'phantom',
      apiKey: 'phantom',
      elo: bot.elo,
      ws: null,
    };

    const engine = new MatchEngine(matchConfig, botConn, phantomConn);

    // Check if bot is a template bot
    const isTemplate = bot.language.startsWith('template:');
    const templateId = isTemplate ? bot.language.replace('template:', '') : null;
    let templateParams: Record<string, number> = {};
    if (isTemplate && bot.description) {
      try { templateParams = JSON.parse(bot.description); } catch { /* defaults */ }
    }
    if (isTemplate) templateBotRunner.init(bot.id);

    // Run match manually (accelerated — no real-time waiting)
    engine.startManual();

    // Feed ticks and let bot trade
    let tickIndex = 0;
    for (const tick of chunk.ticks) {
      engine.updatePrice(tick);

      // Drive template bot
      if (isTemplate && templateId) {
        templateBotRunner.onTick(engine, bot.id, templateId, templateParams, tick);
      }

      tickIndex++;
      if (tickIndex >= duration) break;

      // Advance engine clock every ~1 tick per simulated second
      if (tickIndex % Math.max(1, Math.floor(chunk.ticks.length / duration)) === 0) {
        engine.manualTick();
      }
    }

    // Force remaining ticks
    while (engine.getStatus() === 'running' && engine.getElapsed() < duration) {
      engine.manualTick();
    }

    // Collect result
    let matchResult: any = null;
    engine.on('match:end', (result) => { matchResult = result; });

    // Final ticks to trigger end
    for (let i = 0; i < 10 && engine.getStatus() === 'running'; i++) {
      engine.manualTick();
    }

    if (isTemplate) templateBotRunner.cleanup(bot.id);

    if (!matchResult) {
      return { matchId, score: null, error: 'Match did not produce results' };
    }

    return { matchId, score: matchResult.bot1.score };
  }

  /**
   * Create a challenge — player A's score is recorded, player B plays later
   */
  async createChallenge(
    challengerBotId: string,
    challengerUserId: string,
    targetUserId: string,
    chunkId?: string,
  ): Promise<{ challengeId: string; score: any; error?: string }> {
    // Play the match for the challenger
    const result = await this.playAsync(challengerBotId, chunkId);
    if (result.error) return { challengeId: '', score: null, error: result.error };

    // Save the challenge
    const challenge = await prisma.headToHead.create({
      data: {
        challengerUserId,
        challengerBotId,
        targetUserId,
        chunkId: chunkId || 'synthetic',
        challengerScore: result.score.compositeScore,
        challengerScoreData: JSON.stringify(result.score),
        status: 'PENDING',
      },
    });

    // Notify target
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'CHALLENGE',
        title: 'New Challenge!',
        message: `Someone challenged you! Their score: ${result.score.compositeScore}. Can you beat it?`,
        data: JSON.stringify({ challengeId: challenge.id, score: result.score.compositeScore }),
      },
    });

    return { challengeId: challenge.id, score: result.score };
  }

  /**
   * Accept and play a challenge
   */
  async acceptChallenge(
    challengeId: string,
    defenderBotId: string,
    defenderUserId: string,
  ): Promise<{ winner: string; challengerScore: number; defenderScore: number; error?: string }> {
    const challenge = await prisma.headToHead.findUnique({ where: { id: challengeId } });
    if (!challenge) return { winner: '', challengerScore: 0, defenderScore: 0, error: 'Challenge not found' };
    if (challenge.status !== 'PENDING') return { winner: '', challengerScore: 0, defenderScore: 0, error: 'Challenge already completed' };

    // Play the same data
    const result = await this.playAsync(defenderBotId, challenge.chunkId !== 'synthetic' ? challenge.chunkId : undefined);
    if (result.error) return { winner: '', challengerScore: 0, defenderScore: 0, error: result.error };

    const challengerScore = challenge.challengerScore;
    const defenderScore = result.score.compositeScore;
    const winner = defenderScore > challengerScore ? defenderUserId :
                   challengerScore > defenderScore ? challenge.challengerUserId : 'DRAW';

    // Update challenge
    await prisma.headToHead.update({
      where: { id: challengeId },
      data: {
        defenderUserId,
        defenderBotId,
        defenderScore,
        defenderScoreData: JSON.stringify(result.score),
        winnerId: winner === 'DRAW' ? null : winner,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return { winner, challengerScore, defenderScore };
  }

  private generateSyntheticChunk() {
    const symbols = config.symbols.map(s => s.toUpperCase());
    const ticks: MarketTick[] = [];
    const prices: Record<string, number> = { BTCUSDT: 67500, ETHUSDT: 3200, SOLUSDT: 145 };

    for (let i = 0; i < 300; i++) {
      for (const sym of symbols) {
        const p = prices[sym] || 100;
        const change = (Math.random() - 0.5) * 0.001;
        prices[sym] = p * (1 + change);
        ticks.push({ symbol: sym, price: Math.round(prices[sym] * 100) / 100, volume: Math.random(), timestamp: Date.now() + i * 1000 });
      }
    }

    return { id: 'synthetic', symbols, ticks, sessionType: 'CRYPTO_24H' };
  }
}

export const asyncMatchService = new AsyncMatchService();
