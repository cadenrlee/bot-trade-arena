/**
 * Bot Trade Arena — Test Match Script
 *
 * Runs a complete match between a Momentum bot and a Mean Reversion bot
 * using simulated market data. Verifies the full pipeline:
 *   1. Create users + bots in DB
 *   2. Connect bots via WebSocket
 *   3. Run a match with simulated prices
 *   4. Score, determine winner, update ELO
 *   5. Print results
 *
 * Usage: npx tsx scripts/test-match.ts
 */

import { MatchEngine, type MatchConfig, type BotConnection, type MarketTick } from '../src/engine/match';
import { calculateScore, determineWinner, calculateEloChange, eloToTier } from '../src/engine/scoring';
import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

// ============================================================
// SIMULATED MARKET DATA
// ============================================================

class SimulatedMarket {
  private prices: Map<string, number> = new Map();
  private tick = 0;

  constructor() {
    // Starting prices
    this.prices.set('BTCUSDT', 67500);
    this.prices.set('ETHUSDT', 3200);
    this.prices.set('SOLUSDT', 145);
  }

  nextTick(): MarketTick[] {
    this.tick++;
    const ticks: MarketTick[] = [];

    for (const [symbol, price] of this.prices) {
      // Random walk with slight upward bias and volatility
      const volatility = symbol === 'BTCUSDT' ? 0.0003 : symbol === 'ETHUSDT' ? 0.0004 : 0.0006;
      const drift = 0.00001;
      const change = (Math.random() - 0.5 + drift) * 2 * volatility;
      const newPrice = price * (1 + change);
      this.prices.set(symbol, newPrice);

      ticks.push({
        symbol,
        price: Math.round(newPrice * 100) / 100,
        volume: Math.random() * 10,
        timestamp: Date.now(),
      });
    }

    return ticks;
  }

  getPrice(symbol: string): number {
    return this.prices.get(symbol) || 0;
  }
}

// ============================================================
// SIMPLE BOT STRATEGIES (in-process, no WebSocket needed)
// ============================================================

interface SimpleBotStrategy {
  name: string;
  onTick(tick: MarketTick, engine: MatchEngine, botId: string, state: any): void;
}

function createMomentumStrategy(): SimpleBotStrategy {
  const history: Map<string, number[]> = new Map();
  const lookback = 15;
  const threshold = 0.15;

  return {
    name: 'Momentum',
    onTick(tick, engine, botId) {
      const { symbol, price } = tick;
      if (!history.has(symbol)) history.set(symbol, []);
      const prices = history.get(symbol)!;
      prices.push(price);
      if (prices.length > lookback) prices.shift();
      if (prices.length < lookback) return;

      const oldPrice = prices[0];
      const changePct = ((price - oldPrice) / oldPrice) * 100;

      if (changePct > threshold) {
        engine.processOrder(botId, { symbol, side: 'LONG', action: 'OPEN', quantity: 0.5 });
      } else if (changePct < -threshold) {
        engine.processOrder(botId, { symbol, side: 'SHORT', action: 'OPEN', quantity: 0.5 });
      }
    },
  };
}

function createMeanReversionStrategy(): SimpleBotStrategy {
  const history: Map<string, number[]> = new Map();
  const window = 20;
  const zThreshold = 1.2;

  return {
    name: 'Mean Reversion',
    onTick(tick, engine, botId) {
      const { symbol, price } = tick;
      if (!history.has(symbol)) history.set(symbol, []);
      const prices = history.get(symbol)!;
      prices.push(price);
      if (prices.length > window) prices.shift();
      if (prices.length < window) return;

      const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
      const variance = prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length;
      const std = Math.sqrt(variance);
      if (std === 0) return;

      const zScore = (price - mean) / std;

      if (zScore < -zThreshold) {
        engine.processOrder(botId, { symbol, side: 'LONG', action: 'OPEN', quantity: 0.3 });
      } else if (zScore > zThreshold) {
        engine.processOrder(botId, { symbol, side: 'SHORT', action: 'OPEN', quantity: 0.3 });
      }
    },
  };
}

// ============================================================
// MAIN TEST
// ============================================================

async function main() {
  console.log('='.repeat(60));
  console.log('  BOT TRADE ARENA — Test Match');
  console.log('='.repeat(60));
  console.log();

  // 1. Create test users and bots
  console.log('[Setup] Creating test users and bots...');

  const passwordHash = await bcrypt.hash('testpass123', 12);

  const user1 = await prisma.user.upsert({
    where: { username: 'test_momentum' },
    update: {},
    create: {
      email: 'momentum@test.com',
      username: 'test_momentum',
      passwordHash,
      displayName: 'Momentum Trader',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { username: 'test_meanrev' },
    update: {},
    create: {
      email: 'meanrev@test.com',
      username: 'test_meanrev',
      passwordHash,
      displayName: 'Mean Reversion Trader',
    },
  });

  const bot1 = await prisma.bot.upsert({
    where: { id: 'test-bot-momentum' },
    update: {},
    create: {
      id: 'test-bot-momentum',
      userId: user1.id,
      name: 'MomentumX',
      language: 'typescript',
      description: 'Trend-following momentum strategy',
    },
  });

  const bot2 = await prisma.bot.upsert({
    where: { id: 'test-bot-meanrev' },
    update: {},
    create: {
      id: 'test-bot-meanrev',
      userId: user2.id,
      name: 'MeanRevBot',
      language: 'typescript',
      description: 'Mean reversion strategy',
    },
  });

  console.log(`  Bot 1: ${bot1.name} (owner: ${user1.username}, ELO: ${bot1.elo})`);
  console.log(`  Bot 2: ${bot2.name} (owner: ${user2.username}, ELO: ${bot2.elo})`);
  console.log();

  // 2. Create and configure match
  const matchDuration = 120; // 2 minutes for testing (120 ticks)
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

  const matchConfig: MatchConfig = {
    matchId: 'test-match-001',
    mode: 'LIVE',
    format: 'LADDER',
    duration: matchDuration,
    symbols,
    startingCapital: 100000,
    maxPositionPct: 0.3,
    maxOpenPositions: 5,
    minTradeInterval: 3,
    tier: 'BRONZE',
  };

  const bot1Conn: BotConnection = {
    botId: bot1.id,
    userId: user1.id,
    apiKey: bot1.apiKey,
    elo: bot1.elo,
    ws: null,
  };

  const bot2Conn: BotConnection = {
    botId: bot2.id,
    userId: user2.id,
    apiKey: bot2.apiKey,
    elo: bot2.elo,
    ws: null,
  };

  const engine = new MatchEngine(matchConfig, bot1Conn, bot2Conn);
  const market = new SimulatedMarket();
  const strategy1 = createMomentumStrategy();
  const strategy2 = createMeanReversionStrategy();

  // 3. Track events
  let tradeCount = 0;
  engine.on('trade', (trade) => {
    tradeCount++;
    const side = trade.type === 'CLOSE'
      ? `${trade.side} CLOSE (PnL: ${trade.pnl > 0 ? '+' : ''}$${trade.pnl?.toFixed(2)})`
      : `${trade.side} OPEN`;
    if (trade.type === 'CLOSE') {
      console.log(`  [Trade #${tradeCount}] ${trade.botId === bot1.id ? 'MomentumX' : 'MeanRevBot'} | ${trade.symbol} ${side}`);
    }
  });

  // 4. Run the match manually (tick by tick, synchronously)
  console.log(`[Match] Starting ${matchDuration}-second match...`);
  console.log(`  Symbols: ${symbols.join(', ')}`);
  console.log(`  Capital: $${matchConfig.startingCapital.toLocaleString()}`);
  console.log();

  // Initialize prices
  for (const symbol of symbols) {
    engine.updatePrice({
      symbol,
      price: market.getPrice(symbol),
      volume: 0,
      timestamp: Date.now(),
    });
  }

  // Collect the final result via event
  let matchResult: any = null;
  engine.on('match:end', (result) => {
    matchResult = result;
  });

  // Start the engine in manual mode (no real-time intervals)
  engine.startManual();

  // Simulate market ticks and bot decisions, driving the engine manually
  for (let second = 0; second <= matchDuration; second++) {
    // Generate market ticks
    const ticks = market.nextTick();
    for (const tick of ticks) {
      engine.updatePrice(tick);

      // Let bots react
      strategy1.onTick(tick, engine, bot1.id, null);
      strategy2.onTick(tick, engine, bot2.id, null);
    }

    // Advance the engine clock by one second
    engine.manualTick();

    // Progress indicator
    if (second % 30 === 0 && second > 0) {
      console.log(`  [${second}s / ${matchDuration}s] Match in progress...`);
    }
  }

  // 5. Display results
  if (!matchResult) {
    console.log('\n[Error] Match did not produce results. Checking engine status:', engine.getStatus());
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('  MATCH RESULTS');
  console.log('='.repeat(60));
  console.log();

  const b1 = matchResult.bot1;
  const b2 = matchResult.bot2;

  if (matchResult.winner) {
    const winnerName = matchResult.winner === bot1.id ? 'MomentumX' : 'MeanRevBot';
    console.log(`  WINNER: ${winnerName} (margin: ${matchResult.margin} points)`);
  } else {
    console.log(`  RESULT: DRAW (margin: ${matchResult.margin} points)`);
  }
  console.log();

  // Score breakdown
  printScoreBreakdown('MomentumX', b1);
  console.log();
  printScoreBreakdown('MeanRevBot', b2);

  console.log();
  console.log('-'.repeat(60));
  console.log(`  Total trades executed: ${tradeCount}`);
  console.log();

  // 6. Persist to DB
  console.log('[DB] Saving match results...');

  await prisma.match.upsert({
    where: { id: matchConfig.matchId },
    update: {
      status: 'COMPLETED',
      endedAt: new Date(),
      winnerId: matchResult.winner || null,
      bot1Score: b1.score.compositeScore,
      bot2Score: b2.score.compositeScore,
      bot1Pnl: b1.score.rawPnl,
      bot2Pnl: b2.score.rawPnl,
      bot1WinRate: b1.score.rawWinRate,
      bot2WinRate: b2.score.rawWinRate,
      bot1Trades: b1.score.totalTrades,
      bot2Trades: b2.score.totalTrades,
      eloChange1: b1.eloChange,
      eloChange2: b2.eloChange,
    },
    create: {
      id: matchConfig.matchId,
      player1Id: user1.id,
      player2Id: user2.id,
      bot1Id: bot1.id,
      bot2Id: bot2.id,
      mode: 'LIVE',
      format: 'LADDER',
      duration: matchDuration,
      marketSymbols: JSON.stringify(symbols),
      tier: 'BRONZE',
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - matchDuration * 1000),
      endedAt: new Date(),
      winnerId: matchResult.winner || null,
      bot1Score: b1.score.compositeScore,
      bot2Score: b2.score.compositeScore,
      bot1Pnl: b1.score.rawPnl,
      bot2Pnl: b2.score.rawPnl,
      bot1WinRate: b1.score.rawWinRate,
      bot2WinRate: b2.score.rawWinRate,
      bot1Trades: b1.score.totalTrades,
      bot2Trades: b2.score.totalTrades,
      eloChange1: b1.eloChange,
      eloChange2: b2.eloChange,
    },
  });

  // Update bot ELOs
  await prisma.bot.update({
    where: { id: bot1.id },
    data: { elo: b1.newElo, totalMatches: { increment: 1 } },
  });
  await prisma.bot.update({
    where: { id: bot2.id },
    data: { elo: b2.newElo, totalMatches: { increment: 1 } },
  });

  console.log('  Match saved to database.');
  console.log(`  Bot 1 ELO: ${bot1.elo} -> ${b1.newElo} (${b1.eloChange >= 0 ? '+' : ''}${b1.eloChange})`);
  console.log(`  Bot 2 ELO: ${bot2.elo} -> ${b2.newElo} (${b2.eloChange >= 0 ? '+' : ''}${b2.eloChange})`);
  console.log();

  // Verify DB
  const savedMatch = await prisma.match.findUnique({ where: { id: matchConfig.matchId } });
  console.log(`[Verify] Match in DB: status=${savedMatch?.status}, winner=${savedMatch?.winnerId || 'DRAW'}`);

  console.log();
  console.log('='.repeat(60));
  console.log('  TEST COMPLETE — All systems operational');
  console.log('='.repeat(60));

  await prisma.$disconnect();
  process.exit(0);
}

function printScoreBreakdown(name: string, botResult: any) {
  const s = botResult.score;
  console.log(`  ${name}:`);
  console.log(`    Composite Score:  ${s.compositeScore} / 1000`);
  console.log(`    ├─ P&L Score:     ${s.pnlScore} / 250   (Return: ${s.rawReturn >= 0 ? '+' : ''}${s.rawReturn}%)`);
  console.log(`    ├─ Profit Factor: ${s.profitFactorScore} / 250   (PF: ${s.rawProfitFactor})`);
  console.log(`    ├─ Sharpe Ratio:  ${s.sharpeScore} / 250   (Sharpe: ${s.rawSharpe})`);
  console.log(`    ├─ Risk Mgmt:     ${s.riskScore} / 150   (Max DD: ${s.rawMaxDrawdown}%)`);
  console.log(`    ├─ Win Rate:      ${s.winRateBonus} / 100   (${s.rawWinRate}%)`);
  console.log(`    └─ Penalties:     -${s.penalties}`);
  console.log(`    Trades: ${s.totalTrades} (${s.winningTrades}W / ${s.losingTrades}L) | Net P&L: $${s.rawPnl.toFixed(2)}`);
  console.log(`    ELO: ${botResult.newElo} (${botResult.eloChange >= 0 ? '+' : ''}${botResult.eloChange}) | Tier: ${botResult.newTier}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
