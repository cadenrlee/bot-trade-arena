/**
 * Bot Trade Arena — Match Engine
 *
 * Manages the full lifecycle of a head-to-head match:
 *   1. Setup: Create match, validate bots, allocate resources
 *   2. Start: Connect bots, begin streaming market data
 *   3. Run: Process trades, enforce rules, snapshot state
 *   4. End: Calculate scores, determine winner, update ELO
 *   5. Cleanup: Disconnect bots, publish results, save replay
 */

import { EventEmitter } from 'events';
import {
  calculateScore,
  determineWinner,
  calculateEloChange,
  eloToTier,
  type BotMatchResult,
  type ScoreBreakdown,
  type TradeRecord,
} from './scoring';

// ============================================================
// TYPES
// ============================================================

export interface MatchConfig {
  matchId: string;
  mode: 'LIVE' | 'ASYNC';
  format: 'LADDER' | 'TOURNAMENT' | 'FRIENDLY' | 'CHALLENGE';
  duration: number;           // seconds
  symbols: string[];          // ["BTCUSDT", "ETHUSDT"]
  startingCapital: number;    // e.g., 100000 (virtual USD)
  maxPositionPct: number;     // max % of capital per position
  maxOpenPositions: number;   // max concurrent open positions
  minTradeInterval: number;   // min seconds between trades
  tier: string;
}

export interface BotConnection {
  botId: string;
  userId: string;
  apiKey: string;
  elo: number;
  ws: any; // WebSocket connection
}

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  entryTime: number; // elapsed seconds
  value: number;
}

export interface BotState {
  botId: string;
  cash: number;
  positions: Position[];
  trades: TradeRecord[];
  pnl: number;
  peakCapital: number;
  troughCapital: number;
  capitalHistory: number[];
  lastTradeTime: number;
  tradeCount: number;
  wins: number;
  losses: number;
}

export interface TradeOrder {
  symbol: string;
  side: 'LONG' | 'SHORT';
  action: 'OPEN' | 'CLOSE';
  quantity: number;
  positionId?: string; // required for CLOSE orders
}

export interface MarketTick {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
}

// ============================================================
// MATCH ENGINE
// ============================================================

export class MatchEngine extends EventEmitter {
  private config: MatchConfig;
  private bot1: BotConnection;
  private bot2: BotConnection;
  private state1: BotState;
  private state2: BotState;
  private elapsed: number = 0;
  private interval: NodeJS.Timeout | null = null;
  private snapshotInterval: NodeJS.Timeout | null = null;
  private marketPrices: Map<string, number> = new Map();
  private status: 'pending' | 'running' | 'completed' | 'cancelled' = 'pending';
  private positionCounter: number = 0;

  constructor(config: MatchConfig, bot1: BotConnection, bot2: BotConnection) {
    super();
    this.config = config;
    this.bot1 = bot1;
    this.bot2 = bot2;
    this.state1 = this.initBotState(bot1.botId);
    this.state2 = this.initBotState(bot2.botId);
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  /** Start the match */
  async start(): Promise<void> {
    this.status = 'running';
    this.emit('match:start', {
      matchId: this.config.matchId,
      bot1: this.bot1.botId,
      bot2: this.bot2.botId,
      duration: this.config.duration,
      symbols: this.config.symbols,
    });

    // Main tick loop (every 1 second)
    this.interval = setInterval(() => {
      this.tick();
    }, 1000);

    // Snapshot loop (every 5 seconds for replay)
    this.snapshotInterval = setInterval(() => {
      this.takeSnapshot();
    }, 5000);
  }

  /** Process one second of the match */
  private tick(): void {
    this.elapsed++;

    // Check if match is over
    if (this.elapsed >= this.config.duration) {
      this.end();
      return;
    }

    // Update unrealized P&L for open positions
    this.updateUnrealizedPnl(this.state1);
    this.updateUnrealizedPnl(this.state2);

    // Emit tick event (for spectators and bots)
    this.emit('match:tick', {
      elapsed: this.elapsed,
      remaining: this.config.duration - this.elapsed,
      prices: Object.fromEntries(this.marketPrices),
      bot1: this.getPublicState(this.state1),
      bot2: this.getPublicState(this.state2),
    });
  }

  /** End the match and calculate results */
  private async end(): Promise<void> {
    if (this.status !== 'running') return;
    this.status = 'completed';

    // Clear intervals
    if (this.interval) clearInterval(this.interval);
    if (this.snapshotInterval) clearInterval(this.snapshotInterval);

    // Force-close all open positions at current market price
    this.forceCloseAll(this.state1);
    this.forceCloseAll(this.state2);

    // Calculate scores
    const result1 = this.buildResult(this.state1);
    const result2 = this.buildResult(this.state2);
    const score1 = calculateScore(result1);
    const score2 = calculateScore(result2);
    const { winner, margin } = determineWinner(score1, score2);

    // Calculate ELO changes
    let eloChange1 = 0;
    let eloChange2 = 0;

    if (this.config.format === 'LADDER' || this.config.format === 'TOURNAMENT') {
      if (winner === 0) {
        const changes = calculateEloChange(this.bot1.elo, this.bot2.elo, true);
        eloChange1 = changes.winnerChange;
        eloChange2 = changes.loserChange;
      } else if (winner === 1) {
        const changes = calculateEloChange(this.bot1.elo, this.bot2.elo);
        eloChange1 = changes.winnerChange;
        eloChange2 = changes.loserChange;
      } else {
        const changes = calculateEloChange(this.bot2.elo, this.bot1.elo);
        eloChange1 = changes.loserChange;
        eloChange2 = changes.winnerChange;
      }
    }

    // Emit results
    this.emit('match:end', {
      matchId: this.config.matchId,
      winner: winner === 0 ? null : winner === 1 ? this.bot1.botId : this.bot2.botId,
      margin,
      bot1: {
        botId: this.bot1.botId,
        score: score1,
        eloChange: eloChange1,
        newElo: this.bot1.elo + eloChange1,
        newTier: eloToTier(this.bot1.elo + eloChange1),
      },
      bot2: {
        botId: this.bot2.botId,
        score: score2,
        eloChange: eloChange2,
        newElo: this.bot2.elo + eloChange2,
        newTier: eloToTier(this.bot2.elo + eloChange2),
      },
    });
  }

  /** Cancel the match */
  cancel(reason: string): void {
    this.status = 'cancelled';
    if (this.interval) clearInterval(this.interval);
    if (this.snapshotInterval) clearInterval(this.snapshotInterval);
    this.emit('match:cancelled', { matchId: this.config.matchId, reason });
  }

  // ============================================================
  // TRADE PROCESSING
  // ============================================================

  /**
   * Process a trade order from a bot.
   * Returns: { success, tradeId?, error? }
   */
  processOrder(botId: string, order: TradeOrder): {
    success: boolean;
    tradeId?: string;
    error?: string;
  } {
    const state = botId === this.bot1.botId ? this.state1 : this.state2;

    // Validate match is running
    if (this.status !== 'running') {
      return { success: false, error: 'Match is not running' };
    }

    // Rate limiting
    if (this.elapsed - state.lastTradeTime < this.config.minTradeInterval) {
      return { success: false, error: `Must wait ${this.config.minTradeInterval}s between trades` };
    }

    // Get current price
    const price = this.marketPrices.get(order.symbol);
    if (!price) {
      return { success: false, error: `Unknown symbol: ${order.symbol}` };
    }

    if (order.action === 'OPEN') {
      return this.processOpen(state, order, price);
    } else {
      return this.processClose(state, order, price);
    }
  }

  private processOpen(state: BotState, order: TradeOrder, price: number): {
    success: boolean;
    tradeId?: string;
    error?: string;
  } {
    // Check max open positions
    if (state.positions.length >= this.config.maxOpenPositions) {
      return { success: false, error: `Max ${this.config.maxOpenPositions} open positions` };
    }

    // Check position size
    const orderValue = price * order.quantity;
    const totalCapital = state.cash + state.positions.reduce((sum, p) => sum + p.value, 0);
    if (orderValue > totalCapital * this.config.maxPositionPct) {
      return { success: false, error: `Position exceeds ${this.config.maxPositionPct * 100}% of capital` };
    }

    // Check cash
    if (orderValue > state.cash) {
      return { success: false, error: 'Insufficient cash' };
    }

    // Execute
    const posId = `pos_${++this.positionCounter}`;
    state.positions.push({
      id: posId,
      symbol: order.symbol,
      side: order.side,
      entryPrice: price,
      quantity: order.quantity,
      entryTime: this.elapsed,
      value: orderValue,
    });
    state.cash -= orderValue;
    state.lastTradeTime = this.elapsed;

    // Emit trade event
    this.emit('trade', {
      matchId: this.config.matchId,
      botId: state.botId,
      type: 'OPEN',
      positionId: posId,
      symbol: order.symbol,
      side: order.side,
      price,
      quantity: order.quantity,
      elapsed: this.elapsed,
    });

    return { success: true, tradeId: posId };
  }

  private processClose(state: BotState, order: TradeOrder, price: number): {
    success: boolean;
    tradeId?: string;
    error?: string;
  } {
    // Find position
    const posIdx = state.positions.findIndex(p => p.id === order.positionId);
    if (posIdx === -1) {
      return { success: false, error: `Position not found: ${order.positionId}` };
    }

    const pos = state.positions[posIdx];

    // Calculate P&L
    let pnl: number;
    if (pos.side === 'LONG') {
      pnl = (price - pos.entryPrice) * pos.quantity;
    } else {
      pnl = (pos.entryPrice - price) * pos.quantity;
    }

    // Apply simulated fee (0.1% per trade)
    const fee = price * pos.quantity * 0.001;
    pnl -= fee;

    const isWin = pnl > 0;

    // Record trade
    const trade: TradeRecord = {
      pnl,
      side: pos.side,
      symbol: pos.symbol,
      entryPrice: pos.entryPrice,
      exitPrice: price,
      quantity: pos.quantity,
      holdTime: this.elapsed - pos.entryTime,
    };
    state.trades.push(trade);

    // Update state
    state.cash += pos.value + pnl;
    state.pnl += pnl;
    state.tradeCount++;
    if (isWin) state.wins++;
    else state.losses++;

    // Update peak/trough
    const totalCapital = state.cash + state.positions.reduce((sum, p) => sum + p.value, 0);
    if (totalCapital > state.peakCapital) state.peakCapital = totalCapital;
    if (totalCapital < state.troughCapital) state.troughCapital = totalCapital;

    // Remove position
    state.positions.splice(posIdx, 1);
    state.lastTradeTime = this.elapsed;

    // Emit trade event
    this.emit('trade', {
      matchId: this.config.matchId,
      botId: state.botId,
      type: 'CLOSE',
      positionId: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice: price,
      quantity: pos.quantity,
      pnl: Math.round(pnl * 100) / 100,
      isWin,
      holdTime: this.elapsed - pos.entryTime,
      elapsed: this.elapsed,
    });

    return { success: true, tradeId: pos.id };
  }

  // ============================================================
  // MARKET DATA
  // ============================================================

  /** Update market price (called by market data service) */
  updatePrice(tick: MarketTick): void {
    this.marketPrices.set(tick.symbol, tick.price);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private initBotState(botId: string): BotState {
    return {
      botId,
      cash: this.config.startingCapital,
      positions: [],
      trades: [],
      pnl: 0,
      peakCapital: this.config.startingCapital,
      troughCapital: this.config.startingCapital,
      capitalHistory: [this.config.startingCapital],
      lastTradeTime: -this.config.minTradeInterval, // allow immediate first trade
      tradeCount: 0,
      wins: 0,
      losses: 0,
    };
  }

  private updateUnrealizedPnl(state: BotState): void {
    let totalCapital = state.cash;
    for (const pos of state.positions) {
      const currentPrice = this.marketPrices.get(pos.symbol) || pos.entryPrice;
      if (pos.side === 'LONG') {
        totalCapital += (currentPrice * pos.quantity);
      } else {
        totalCapital += pos.value + (pos.entryPrice - currentPrice) * pos.quantity;
      }
    }
    state.capitalHistory.push(totalCapital);
    if (totalCapital > state.peakCapital) state.peakCapital = totalCapital;
    if (totalCapital < state.troughCapital) state.troughCapital = totalCapital;
  }

  private forceCloseAll(state: BotState): void {
    const positionsCopy = [...state.positions];
    for (const pos of positionsCopy) {
      const price = this.marketPrices.get(pos.symbol) || pos.entryPrice;
      this.processClose(state, {
        symbol: pos.symbol,
        side: pos.side,
        action: 'CLOSE',
        quantity: pos.quantity,
        positionId: pos.id,
      }, price);
    }
  }

  private buildResult(state: BotState): BotMatchResult {
    return {
      trades: state.trades,
      finalPnl: state.pnl,
      startingCapital: this.config.startingCapital,
      peakCapital: state.peakCapital,
      troughCapital: state.troughCapital,
      capitalHistory: state.capitalHistory,
    };
  }

  private getPublicState(state: BotState) {
    const totalCapital = state.capitalHistory[state.capitalHistory.length - 1] || this.config.startingCapital;
    return {
      botId: state.botId,
      pnl: Math.round(state.pnl * 100) / 100,
      totalCapital: Math.round(totalCapital * 100) / 100,
      trades: state.tradeCount,
      wins: state.wins,
      losses: state.losses,
      winRate: state.tradeCount > 0
        ? Math.round((state.wins / state.tradeCount) * 1000) / 10
        : 0,
      openPositions: state.positions.length,
    };
  }

  private takeSnapshot(): void {
    const cap1 = this.state1.capitalHistory[this.state1.capitalHistory.length - 1] || this.config.startingCapital;
    const cap2 = this.state2.capitalHistory[this.state2.capitalHistory.length - 1] || this.config.startingCapital;

    this.emit('match:snapshot', {
      matchId: this.config.matchId,
      elapsed: this.elapsed,
      bot1: this.getPublicState(this.state1),
      bot2: this.getPublicState(this.state2),
      prices: Object.fromEntries(this.marketPrices),
    });
  }

  // ============================================================
  // GETTERS
  // ============================================================

  getStatus() { return this.status; }
  getElapsed() { return this.elapsed; }
  getConfig() { return this.config; }

  /** Get full live state for REST polling */
  getLiveState() {
    return {
      status: this.status,
      elapsed: this.elapsed,
      remaining: this.config.duration - this.elapsed,
      duration: this.config.duration,
      prices: Object.fromEntries(this.marketPrices),
      bot1: this.getPublicState(this.state1),
      bot2: this.getPublicState(this.state2),
      recentTrades: [
        ...this.state1.trades.slice(-5).map(t => ({ ...t, botId: this.bot1.botId })),
        ...this.state2.trades.slice(-5).map(t => ({ ...t, botId: this.bot2.botId })),
      ].sort((a, b) => b.holdTime - a.holdTime),
    };
  }

  /** Manually advance the match by one tick (for testing without real-time intervals) */
  manualTick(): void {
    if (this.status === 'running') {
      this.tick();
    }
  }

  /** Start match without timers (for testing — caller drives ticks via manualTick) */
  startManual(): void {
    this.status = 'running';
    this.emit('match:start', {
      matchId: this.config.matchId,
      bot1: this.bot1.botId,
      bot2: this.bot2.botId,
      duration: this.config.duration,
      symbols: this.config.symbols,
    });
  }
}
