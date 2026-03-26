import { MatchEngine, type MatchConfig, type BotConnection, type MarketTick } from '../engine/match';
import { eloToTier } from '../engine/scoring';
import { templateBotRunner } from './templateBots';
import { MarketRecorder } from './marketRecorder';
import { config } from '../lib/config';
import prisma from '../lib/prisma';
import crypto from 'crypto';

/**
 * Async Match Service — enables challenges and after-hours play.
 *
 * How it works:
 *   1. Generate or use recorded market data (a chunk of price ticks)
 *   2. Run the bot against that data at accelerated speed
 *   3. Score the result
 *   4. For challenges: both players replay the same data, compare scores
 *
 * For bots without server-side strategy (external bots), we use a
 * momentum-based auto-strategy that simulates reasonable trading behavior
 * based on the bot's ELO (higher ELO = better trading logic).
 */

export class AsyncMatchService {

  async playAsync(botId: string, chunkTicks?: MarketTick[]): Promise<{
    matchId: string; score: any; replay?: any[]; trades?: any[]; error?: string;
  }> {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return { matchId: '', score: null, error: 'Bot not found' };

    // Get or generate market data — prefer real recorded data
    let ticks: MarketTick[];
    if (chunkTicks) {
      ticks = chunkTicks;
    } else {
      try {
        const chunk = await MarketRecorder.getRandomChunk();
        if (chunk && chunk.ticks && chunk.ticks.length > 30) {
          ticks = chunk.ticks;
          console.log(`[Async] Using real market data: ${chunk.ticks.length} ticks from ${chunk.startTime}`);
        } else {
          ticks = this.generateTicks();
          console.log('[Async] No recorded data available, using synthetic');
        }
      } catch {
        ticks = this.generateTicks();
      }
    }
    const symbols = [...new Set(ticks.map(t => t.symbol))];
    const duration = Math.min(Math.floor(ticks.length / Math.max(symbols.length, 1)), 300);

    if (duration < 10) return { matchId: '', score: null, error: 'Not enough market data' };

    const matchId = crypto.randomBytes(12).toString('hex');

    const matchConfig: MatchConfig = {
      matchId, mode: 'ASYNC', format: 'LADDER', duration, symbols,
      startingCapital: config.match.startingCapital,
      maxPositionPct: config.match.maxPositionPct,
      maxOpenPositions: config.match.maxOpenPositions,
      minTradeInterval: config.match.minTradeInterval,
      tier: eloToTier(bot.elo),
    };

    const botConn: BotConnection = { botId: bot.id, userId: bot.userId, apiKey: bot.apiKey, elo: bot.elo, ws: null };
    const phantomConn: BotConnection = { botId: 'phantom', userId: 'phantom', apiKey: 'x', elo: bot.elo, ws: null };

    const engine = new MatchEngine(matchConfig, botConn, phantomConn);

    // Determine strategy
    const isTemplate = bot.language.startsWith('template:');
    const templateId = isTemplate ? bot.language.replace('template:', '') : null;
    let templateParams: Record<string, number> = {};
    if (isTemplate && bot.description) {
      try { templateParams = JSON.parse(bot.description); } catch { /* defaults */ }
    }
    if (isTemplate) templateBotRunner.init(bot.id);

    // For non-template bots, use auto-strategy based on ELO
    const autoStrategy = !isTemplate ? this.createAutoStrategy(bot.elo) : null;

    // Record replay timeline
    const replay: any[] = [];
    const tradeLog: any[] = [];

    let matchResult: any = null;
    engine.on('match:end', (result) => { matchResult = result; });
    engine.on('trade', (trade) => { tradeLog.push({ ...trade, second: engine.getElapsed() }); });
    engine.startManual();

    // Feed ticks and record state every second
    let tickIdx = 0;
    const ticksPerSecond = Math.max(1, Math.floor(ticks.length / duration));

    for (let sec = 0; sec < duration; sec++) {
      for (let t = 0; t < ticksPerSecond && tickIdx < ticks.length; t++, tickIdx++) {
        const tick = ticks[tickIdx];
        engine.updatePrice(tick);

        if (isTemplate && templateId) {
          templateBotRunner.onTick(engine, bot.id, templateId, templateParams, tick);
        } else if (autoStrategy) {
          autoStrategy(engine, bot.id, tick);
        }
      }
      engine.manualTick();

      // Snapshot state for replay
      const live = engine.getLiveState();
      replay.push({
        second: sec + 1,
        bot1Pnl: live.bot1.pnl,
        bot2Pnl: live.bot2.pnl,
        bot1Trades: live.bot1.trades,
        bot2Trades: live.bot2.trades,
        bot1Wins: live.bot1.wins,
        bot2Wins: live.bot2.losses, // phantom doesn't trade
      });
    }

    while (engine.getStatus() === 'running') engine.manualTick();
    if (isTemplate) templateBotRunner.cleanup(bot.id);

    if (!matchResult) return { matchId, score: null, replay: [], trades: [], error: 'Match produced no results' };
    return { matchId, score: matchResult.bot1.score, replay, trades: tradeLog };
  }

  async createChallenge(challengerBotId: string, challengerUserId: string, targetUserId: string): Promise<{
    challengeId: string; score: any; replay?: any[]; trades?: any[]; error?: string;
  }> {
    // Prefer real recorded market data over synthetic
    let ticks: MarketTick[];
    try {
      const chunk = await MarketRecorder.getRandomChunk();
      if (chunk && chunk.ticks && chunk.ticks.length > 30) {
        ticks = chunk.ticks;
        console.log(`[Challenge] Using real market data: ${chunk.ticks.length} ticks from ${chunk.startTime}`);
      } else {
        ticks = this.generateTicks();
        console.log('[Challenge] No recorded data available, using synthetic');
      }
    } catch {
      ticks = this.generateTicks();
    }

    // Play for the challenger
    const result = await this.playAsync(challengerBotId, ticks);
    if (result.error) return { challengeId: '', score: null, error: result.error };

    // Save challenge with the market data so defender can replay the same thing
    const challenge = await prisma.headToHead.create({
      data: {
        challengerUserId,
        challengerBotId,
        targetUserId,
        chunkId: 'synthetic',
        challengerScore: result.score?.compositeScore || 0,
        challengerScoreData: JSON.stringify(result.score),
        syntheticChunkData: JSON.stringify(ticks), // Store the exact ticks
        status: 'PENDING',
      },
    });

    // Notify target
    const challenger = await prisma.user.findUnique({ where: { id: challengerUserId }, select: { username: true } });
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'CHALLENGE',
        title: `${challenger?.username || 'Someone'} challenged you!`,
        message: `Their score: ${result.score?.compositeScore || 0}. Beat it!`,
        data: JSON.stringify({ challengeId: challenge.id }),
      },
    });

    return { challengeId: challenge.id, score: result.score, replay: result.replay, trades: result.trades };
  }

  async acceptChallenge(challengeId: string, defenderBotId: string, defenderUserId: string): Promise<{
    winner: string; challengerScore: number; defenderScore: number; error?: string;
  }> {
    const challenge = await prisma.headToHead.findUnique({ where: { id: challengeId } });
    if (!challenge) return { winner: '', challengerScore: 0, defenderScore: 0, error: 'Challenge not found' };
    if (challenge.status !== 'PENDING') return { winner: '', challengerScore: 0, defenderScore: 0, error: 'Already completed' };

    // Replay the SAME market data
    let ticks: MarketTick[];
    if (challenge.syntheticChunkData) {
      ticks = JSON.parse(challenge.syntheticChunkData);
    } else {
      ticks = this.generateTicks(); // Fallback — not ideal but better than crashing
    }

    const result = await this.playAsync(defenderBotId, ticks);
    if (result.error) return { winner: '', challengerScore: 0, defenderScore: 0, error: result.error };

    const challengerScore = challenge.challengerScore;
    const defenderScore = result.score?.compositeScore || 0;
    const winner = defenderScore > challengerScore ? defenderUserId :
                   challengerScore > defenderScore ? challenge.challengerUserId : 'DRAW';

    await prisma.headToHead.update({
      where: { id: challengeId },
      data: {
        defenderUserId, defenderBotId,
        defenderScore, defenderScoreData: JSON.stringify(result.score),
        winnerId: winner === 'DRAW' ? null : winner,
        status: 'COMPLETED', completedAt: new Date(),
      },
    });

    return { winner, challengerScore, defenderScore };
  }

  /**
   * Auto-strategy for bots without server-side logic.
   * Uses momentum + mean reversion, quality scales with ELO.
   */
  private createAutoStrategy(elo: number) {
    const history: Map<string, number[]> = new Map();
    const positions: Map<string, { side: string; entry: number; posId?: string }> = new Map();
    const skill = Math.min(1, Math.max(0.2, (elo - 800) / 1200)); // 0.2 at 800 ELO, 1.0 at 2000
    let lastTradeTime = -10;

    return (engine: MatchEngine, botId: string, tick: MarketTick) => {
      const { symbol, price } = tick;
      const elapsed = engine.getElapsed();

      if (!history.has(symbol)) history.set(symbol, []);
      const h = history.get(symbol)!;
      h.push(price);
      if (h.length > 30) h.shift();
      if (h.length < 10) return;
      if (elapsed - lastTradeTime < 4) return;

      const mean = h.reduce((s, p) => s + p, 0) / h.length;
      const momentum = ((price - h[0]) / h[0]) * 100;
      const existing = positions.get(symbol);

      // Close positions
      if (existing) {
        const pnlPct = existing.side === 'LONG'
          ? (price - existing.entry) / existing.entry
          : (existing.entry - price) / existing.entry;

        // Take profit or stop loss (better players have tighter stops)
        const tp = 0.002 * (1 + skill);
        const sl = 0.003 / skill;

        if (pnlPct > tp || pnlPct < -sl || (elapsed - lastTradeTime > 20 && Math.random() < 0.1)) {
          const result = engine.processOrder(botId, {
            symbol, side: existing.side as 'LONG' | 'SHORT', action: 'CLOSE',
            quantity: 0.1, positionId: existing.posId,
          });
          if (result.success) { positions.delete(symbol); lastTradeTime = elapsed; }
        }
        return;
      }

      // Open positions based on skill-weighted signals
      const tradeChance = 0.05 + skill * 0.08; // Higher ELO = more active
      if (Math.random() > tradeChance) return;

      // Better players read momentum more accurately
      const correctRead = Math.random() < (0.4 + skill * 0.3); // 40-70% accuracy based on ELO
      let side: 'LONG' | 'SHORT';

      if (momentum > 0.05) {
        side = correctRead ? 'LONG' : 'SHORT';
      } else if (momentum < -0.05) {
        side = correctRead ? 'SHORT' : 'LONG';
      } else {
        // Mean reversion in ranging market
        side = price < mean ? 'LONG' : 'SHORT';
        if (!correctRead) side = side === 'LONG' ? 'SHORT' : 'LONG';
      }

      const result = engine.processOrder(botId, {
        symbol, side, action: 'OPEN', quantity: 0.08 + skill * 0.04,
      });
      if (result.success && result.tradeId) {
        positions.set(symbol, { side, entry: price, posId: result.tradeId });
        lastTradeTime = elapsed;
      }
    };
  }

  private generateTicks(): MarketTick[] {
    const symbols = config.symbols.map(s => s.toUpperCase());
    const ticks: MarketTick[] = [];
    const prices: Record<string, number> = { BTCUSDT: 67500, ETHUSDT: 3200, SOLUSDT: 145 };
    let momentum = 0;

    for (let i = 0; i < 900; i++) { // 300 seconds * 3 symbols
      momentum = momentum * 0.95 + (Math.random() - 0.5) * 0.0005;
      for (const sym of symbols) {
        const p = prices[sym] || 100;
        const vol = sym === 'BTCUSDT' ? 0.0003 : sym === 'ETHUSDT' ? 0.0004 : 0.0006;
        const change = momentum + (Math.random() - 0.5) * vol * 2;
        prices[sym] = Math.max(p * 0.9, p * (1 + change));
        ticks.push({
          symbol: sym,
          price: Math.round(prices[sym] * 100) / 100,
          volume: Math.random() * 5,
          timestamp: Date.now() + Math.floor(i / symbols.length) * 1000,
        });
      }
    }
    return ticks;
  }
}

export const asyncMatchService = new AsyncMatchService();
