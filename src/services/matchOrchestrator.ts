import { EventEmitter } from 'events';
import { MatchEngine, type MatchConfig, type BotConnection, type MarketTick } from '../engine/match';
import { Matchmaker, type QueuedBot, type MatchPair } from '../engine/matchmaker';
import { eloToTier } from '../engine/scoring';
import { MarketDataService } from './marketData';
import { houseBotService } from './houseBots';
import { templateBotRunner } from './templateBots';
import { config } from '../lib/config';
import prisma from '../lib/prisma';
import crypto from 'crypto';
function createId() { return crypto.randomBytes(12).toString('hex'); }

interface ConnectedBot {
  botId: string;
  userId: string;
  apiKey: string;
  elo: number;
  ws: any;
}

/**
 * Orchestrates the full match lifecycle:
 *   - Manages the matchmaking queue
 *   - Creates match instances when pairs are found
 *   - Feeds market data to active matches
 *   - Persists results to database
 */
export class MatchOrchestrator extends EventEmitter {
  private matchmaker = new Matchmaker();
  private marketData: MarketDataService;
  private activeMatches: Map<string, MatchEngine> = new Map();
  private matchmakingInterval: NodeJS.Timeout | null = null;
  private botToMatch: Map<string, string> = new Map(); // botId -> matchId

  constructor(marketData: MarketDataService) {
    super();
    this.marketData = marketData;

    // Forward market ticks to all active matches
    this.marketData.on('tick', (tick: MarketTick) => {
      for (const match of this.activeMatches.values()) {
        match.updatePrice(tick);
      }
    });
  }

  start(): void {
    // Run matchmaking every 3 seconds
    this.matchmakingInterval = setInterval(() => {
      this.runMatchmaking();
    }, 3000);
    console.log('[Orchestrator] Match orchestrator started');
  }

  stop(): void {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval);
      this.matchmakingInterval = null;
    }
  }

  queueBot(bot: ConnectedBot): void {
    const tier = eloToTier(bot.elo);
    const queued: QueuedBot = {
      botId: bot.botId,
      userId: bot.userId,
      elo: bot.elo,
      tier,
      queuedAt: Date.now(),
      mode: 'LIVE',
    };
    this.matchmaker.enqueue(queued);
    console.log(`[Orchestrator] Bot ${bot.botId} queued (ELO: ${bot.elo}, Tier: ${tier})`);
    this.emit('bot:queued', { botId: bot.botId, tier });
  }

  dequeueBot(botId: string): void {
    this.matchmaker.dequeue(botId);
  }

  getActiveMatch(matchId: string): MatchEngine | undefined {
    return this.activeMatches.get(matchId);
  }

  getMatchForBot(botId: string): MatchEngine | undefined {
    const matchId = this.botToMatch.get(botId);
    return matchId ? this.activeMatches.get(matchId) : undefined;
  }

  getQueueStats() {
    return this.matchmaker.getQueueStats();
  }

  /**
   * Start a match against a house bot (AI opponent).
   * Always available — no need for another player.
   */
  async startVsAI(
    playerBotId: string,
    houseBotDifficulty?: 'ROOKIE' | 'VETERAN' | 'ELITE',
    matchMode: string = 'crypto',
  ): Promise<{ matchId: string; error?: string }> {
    const playerBot = await prisma.bot.findUnique({ where: { id: playerBotId }, include: { user: true } });
    if (!playerBot) return { matchId: '', error: 'Bot not found' };

    // Pick house bot
    const houseBotDef = houseBotDifficulty
      ? houseBotService.getAvailableBots().find(b => b.difficulty === houseBotDifficulty)
      : houseBotService.getBestMatch(playerBot.elo);
    if (!houseBotDef) return { matchId: '', error: 'House bot not found' };

    const houseBot = await prisma.bot.findUnique({ where: { id: houseBotDef.id } });
    if (!houseBot) return { matchId: '', error: 'House bot not in DB — run server restart' };

    const matchId = createId();
    const symbols = matchMode === 'stocks'
      ? config.stockSymbols.map(s => s.toUpperCase())
      : config.symbols.map(s => s.toUpperCase());
    const tier = eloToTier(playerBot.elo);

    const matchConfig: MatchConfig = {
      matchId,
      mode: 'LIVE',
      format: 'LADDER',
      duration: config.match.duration,
      symbols,
      startingCapital: config.match.startingCapital,
      maxPositionPct: config.match.maxPositionPct,
      maxOpenPositions: config.match.maxOpenPositions,
      minTradeInterval: config.match.minTradeInterval,
      tier,
    };

    const bot1Conn: BotConnection = {
      botId: playerBot.id,
      userId: playerBot.userId,
      apiKey: playerBot.apiKey,
      elo: playerBot.elo,
      ws: null,
    };
    const bot2Conn: BotConnection = {
      botId: houseBot.id,
      userId: houseBot.userId,
      apiKey: houseBot.apiKey,
      elo: houseBot.elo,
      ws: null,
    };

    const engine = new MatchEngine(matchConfig, bot1Conn, bot2Conn);
    this.activeMatches.set(matchId, engine);
    this.botToMatch.set(playerBot.id, matchId);
    this.botToMatch.set(houseBot.id, matchId);

    // Save to DB
    await prisma.match.create({
      data: {
        id: matchId,
        player1Id: playerBot.userId,
        player2Id: houseBotService.getHouseUserId(),
        bot1Id: playerBot.id,
        bot2Id: houseBot.id,
        mode: 'LIVE',
        format: 'LADDER',
        duration: config.match.duration,
        marketSymbols: JSON.stringify(symbols),
        tier,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    await prisma.bot.update({ where: { id: playerBot.id }, data: { status: 'IN_MATCH' } });

    // Set initial prices
    for (const symbol of symbols) {
      const price = this.marketData.getPrice(symbol);
      if (price) engine.updatePrice({ symbol, price, volume: 0, timestamp: Date.now() });
    }

    // Wire up match end
    engine.on('match:end', async (result) => {
      houseBotService.clearHistory(houseBot.id);
      templateBotRunner.cleanup(playerBot.id);
      await this.handleMatchEnd(matchId, result);
    });

    // Forward events
    engine.on('match:tick', (data) => {
      this.emit('match:tick', { matchId, ...data });
    });
    engine.on('trade', (data) => {
      this.emit('match:trade', data);
    });

    // Check if player's bot is a template bot (server-side execution)
    const isTemplateBotPlayer = playerBot.language.startsWith('template:');
    const playerTemplateId = isTemplateBotPlayer ? playerBot.language.replace('template:', '') : null;
    let playerTemplateParams: Record<string, number> = {};
    if (isTemplateBotPlayer && playerBot.description) {
      try { playerTemplateParams = JSON.parse(playerBot.description); } catch { /* use defaults */ }
    }
    if (isTemplateBotPlayer) {
      templateBotRunner.init(playerBot.id);
    }

    // Drive bots on every tick
    engine.on('match:tick', (data) => {
      if (data.prices) {
        for (const [symbol, price] of Object.entries(data.prices)) {
          const tick = { symbol, price: price as number, volume: 0, timestamp: Date.now() };

          // Drive house bot
          houseBotService.onTick(engine, houseBot.id, tick);

          // Drive template bot (if player is using one)
          if (isTemplateBotPlayer && playerTemplateId) {
            templateBotRunner.onTick(engine, playerBot.id, playerTemplateId, playerTemplateParams, tick);
          }
        }
      }
    });

    this.emit('match:created', {
      matchId,
      bot1Id: playerBot.id,
      bot2Id: houseBot.id,
      config: matchConfig,
    });

    console.log(`[Orchestrator] VS AI match ${matchId}: ${playerBot.name} vs ${houseBot.name} (${houseBotDef.difficulty})`);

    await engine.start();
    return { matchId };
  }

  private async runMatchmaking(): Promise<void> {
    const pairs = this.matchmaker.findMatches();
    for (const pair of pairs) {
      await this.createMatch(pair);
    }
  }

  private async createMatch(pair: MatchPair): Promise<void> {
    const matchId = createId();
    const symbols = config.symbols.map(s => s.toUpperCase());
    const tier = eloToTier(Math.round((pair.bot1.elo + pair.bot2.elo) / 2));

    const matchConfig: MatchConfig = {
      matchId,
      mode: 'LIVE',
      format: 'LADDER',
      duration: config.match.duration,
      symbols,
      startingCapital: config.match.startingCapital,
      maxPositionPct: config.match.maxPositionPct,
      maxOpenPositions: config.match.maxOpenPositions,
      minTradeInterval: config.match.minTradeInterval,
      tier,
    };

    // Look up bot DB records
    const [bot1Db, bot2Db] = await Promise.all([
      prisma.bot.findUnique({ where: { id: pair.bot1.botId } }),
      prisma.bot.findUnique({ where: { id: pair.bot2.botId } }),
    ]);
    if (!bot1Db || !bot2Db) return;

    const bot1Conn: BotConnection = {
      botId: pair.bot1.botId,
      userId: pair.bot1.userId,
      apiKey: bot1Db.apiKey,
      elo: bot1Db.elo,
      ws: null,
    };
    const bot2Conn: BotConnection = {
      botId: pair.bot2.botId,
      userId: pair.bot2.userId,
      apiKey: bot2Db.apiKey,
      elo: bot2Db.elo,
      ws: null,
    };

    const engine = new MatchEngine(matchConfig, bot1Conn, bot2Conn);
    this.activeMatches.set(matchId, engine);
    this.botToMatch.set(pair.bot1.botId, matchId);
    this.botToMatch.set(pair.bot2.botId, matchId);

    // Create match in DB
    await prisma.match.create({
      data: {
        id: matchId,
        player1Id: pair.bot1.userId,
        player2Id: pair.bot2.userId,
        bot1Id: pair.bot1.botId,
        bot2Id: pair.bot2.botId,
        mode: 'LIVE',
        format: 'LADDER',
        duration: config.match.duration,
        marketSymbols: JSON.stringify(symbols),
        tier,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Update bot statuses
    await Promise.all([
      prisma.bot.update({ where: { id: pair.bot1.botId }, data: { status: 'IN_MATCH' } }),
      prisma.bot.update({ where: { id: pair.bot2.botId }, data: { status: 'IN_MATCH' } }),
    ]);

    // Set initial prices from market data
    for (const symbol of symbols) {
      const price = this.marketData.getPrice(symbol);
      if (price) {
        engine.updatePrice({ symbol, price, volume: 0, timestamp: Date.now() });
      }
    }

    // Listen for match end
    engine.on('match:end', async (result) => {
      await this.handleMatchEnd(matchId, result);
    });

    // Emit match:start for WebSocket broadcasting
    this.emit('match:created', {
      matchId,
      bot1Id: pair.bot1.botId,
      bot2Id: pair.bot2.botId,
      config: matchConfig,
    });

    // Forward engine events
    engine.on('match:tick', (data) => {
      this.emit('match:tick', { matchId, ...data });
    });
    engine.on('trade', (data) => {
      this.emit('match:trade', data);
    });

    console.log(`[Orchestrator] Match ${matchId} created: ${pair.bot1.botId} vs ${pair.bot2.botId}`);

    // Start the match
    await engine.start();
  }

  private async handleMatchEnd(matchId: string, result: any): Promise<void> {
    const engine = this.activeMatches.get(matchId);
    if (!engine) return;

    // Emit immediately for real-time WebSocket broadcasting (don't wait for DB)
    this.emit('match:ended', { matchId, result });

    // Cleanup in-memory state first
    this.activeMatches.delete(matchId);
    this.botToMatch.delete(result.bot1.botId);
    this.botToMatch.delete(result.bot2.botId);

    // Batch all DB writes in a single transaction (1 round trip instead of 5+)
    try {
      const [bot1, bot2] = await Promise.all([
        prisma.bot.findUnique({ where: { id: result.bot1.botId }, select: { userId: true, winStreak: true, bestWinStreak: true, avgScore: true, bestScore: true, totalMatches: true } }),
        prisma.bot.findUnique({ where: { id: result.bot2.botId }, select: { userId: true, winStreak: true, bestWinStreak: true, avgScore: true, bestScore: true, totalMatches: true } }),
      ]);

      const b1IsWinner = result.winner === result.bot1.botId;
      const b2IsWinner = result.winner === result.bot2.botId;
      const b1WinStreak = b1IsWinner ? (bot1?.winStreak || 0) + 1 : 0;
      const b2WinStreak = b2IsWinner ? (bot2?.winStreak || 0) + 1 : 0;

      await prisma.$transaction([
        // 1. Update match record
        prisma.match.update({
          where: { id: matchId },
          data: {
            status: 'COMPLETED',
            endedAt: new Date(),
            winnerId: result.winner || null,
            bot1Score: result.bot1.score.compositeScore,
            bot2Score: result.bot2.score.compositeScore,
            bot1Pnl: result.bot1.score.rawPnl,
            bot2Pnl: result.bot2.score.rawPnl,
            bot1WinRate: result.bot1.score.rawWinRate,
            bot2WinRate: result.bot2.score.rawWinRate,
            bot1Sharpe: result.bot1.score.rawSharpe,
            bot2Sharpe: result.bot2.score.rawSharpe,
            bot1MaxDd: result.bot1.score.rawMaxDrawdown,
            bot2MaxDd: result.bot2.score.rawMaxDrawdown,
            bot1Trades: result.bot1.score.totalTrades,
            bot2Trades: result.bot2.score.totalTrades,
            eloChange1: result.bot1.eloChange,
            eloChange2: result.bot2.eloChange,
          },
        }),
        // 2. Update bot1 stats
        prisma.bot.update({
          where: { id: result.bot1.botId },
          data: {
            elo: result.bot1.newElo,
            status: 'CONNECTED',
            totalMatches: { increment: 1 },
            totalWins: { increment: b1IsWinner ? 1 : 0 },
            totalLosses: { increment: (!b1IsWinner && result.bot1.eloChange < 0) ? 1 : 0 },
            totalDraws: { increment: result.bot1.eloChange === 0 ? 1 : 0 },
            bestScore: Math.max(bot1?.bestScore || 0, result.bot1.score.compositeScore),
            avgScore: bot1 ? (bot1.avgScore * bot1.totalMatches + result.bot1.score.compositeScore) / (bot1.totalMatches + 1) : result.bot1.score.compositeScore,
            winStreak: b1WinStreak,
            bestWinStreak: Math.max(bot1?.bestWinStreak || 0, b1WinStreak),
          },
        }),
        // 3. Update bot2 stats
        prisma.bot.update({
          where: { id: result.bot2.botId },
          data: {
            elo: result.bot2.newElo,
            status: 'CONNECTED',
            totalMatches: { increment: 1 },
            totalWins: { increment: b2IsWinner ? 1 : 0 },
            totalLosses: { increment: (!b2IsWinner && result.bot2.eloChange < 0) ? 1 : 0 },
            totalDraws: { increment: result.bot2.eloChange === 0 ? 1 : 0 },
            bestScore: Math.max(bot2?.bestScore || 0, result.bot2.score.compositeScore),
            avgScore: bot2 ? (bot2.avgScore * bot2.totalMatches + result.bot2.score.compositeScore) / (bot2.totalMatches + 1) : result.bot2.score.compositeScore,
            winStreak: b2WinStreak,
            bestWinStreak: Math.max(bot2?.bestWinStreak || 0, b2WinStreak),
          },
        }),
        // 4. Update user1 ELO
        ...(bot1 ? [prisma.user.update({
          where: { id: bot1.userId },
          data: {
            elo: result.bot1.newElo,
            tier: result.bot1.newTier,
            totalMatches: { increment: 1 },
            totalWins: { increment: b1IsWinner ? 1 : 0 },
            totalLosses: { increment: result.winner && !b1IsWinner ? 1 : 0 },
          },
        })] : []),
        // 5. Update user2 ELO
        ...(bot2 ? [prisma.user.update({
          where: { id: bot2.userId },
          data: {
            elo: result.bot2.newElo,
            tier: result.bot2.newTier,
            totalMatches: { increment: 1 },
            totalWins: { increment: b2IsWinner ? 1 : 0 },
            totalLosses: { increment: result.winner && !b2IsWinner ? 1 : 0 },
          },
        })] : []),
      ]);
    } catch (err) {
      console.error('[Orchestrator] Error persisting match results:', err);
    }

    console.log(`[Orchestrator] Match ${matchId} completed. Winner: ${result.winner || 'DRAW'}`);
  }
}
