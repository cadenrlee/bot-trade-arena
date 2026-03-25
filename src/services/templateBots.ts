import { MatchEngine, type MarketTick } from '../engine/match';

/**
 * Template Bot Strategies — server-side bot execution.
 * Users pick a strategy + configure parameters, the server runs it.
 * No code writing needed.
 */

export interface BotTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  params: TemplateParam[];
}

export interface TemplateParam {
  key: string;
  label: string;
  type: 'number' | 'select';
  default: number | string;
  min?: number;
  max?: number;
  options?: { label: string; value: string | number }[];
  description: string;
}

// ============================================================
// TEMPLATE DEFINITIONS
// ============================================================

export const BOT_TEMPLATES: BotTemplate[] = [
  {
    id: 'momentum',
    name: 'Momentum Rider',
    description: 'Follows price trends. Buys when price is rising, sells when falling. Simple but effective in trending markets.',
    category: 'Trend Following',
    difficulty: 'BEGINNER',
    params: [
      { key: 'lookback', label: 'Lookback Period', type: 'number', default: 15, min: 5, max: 60, description: 'How many ticks to look back for trend' },
      { key: 'threshold', label: 'Trigger Threshold (%)', type: 'number', default: 0.15, min: 0.05, max: 1.0, description: 'Price change % to trigger a trade' },
      { key: 'positionSize', label: 'Position Size (%)', type: 'number', default: 10, min: 5, max: 25, description: '% of capital per trade' },
    ],
  },
  {
    id: 'mean-reversion',
    name: 'Mean Reversion',
    description: 'Buys when price drops below average, sells when above. Profits from price oscillations around the mean.',
    category: 'Mean Reversion',
    difficulty: 'BEGINNER',
    params: [
      { key: 'window', label: 'Moving Average Window', type: 'number', default: 20, min: 10, max: 50, description: 'Period for calculating average price' },
      { key: 'zThreshold', label: 'Z-Score Threshold', type: 'number', default: 1.2, min: 0.5, max: 3.0, description: 'Standard deviations from mean to trigger' },
      { key: 'positionSize', label: 'Position Size (%)', type: 'number', default: 8, min: 5, max: 25, description: '% of capital per trade' },
    ],
  },
  {
    id: 'grid-trader',
    name: 'Grid Trader',
    description: 'Places buy and sell orders at fixed price intervals. Profits from volatility regardless of direction.',
    category: 'Market Making',
    difficulty: 'INTERMEDIATE',
    params: [
      { key: 'gridSpacing', label: 'Grid Spacing (%)', type: 'number', default: 0.3, min: 0.1, max: 1.0, description: 'Price interval between grid levels' },
      { key: 'gridLevels', label: 'Grid Levels', type: 'number', default: 3, min: 2, max: 5, description: 'Number of grid levels above and below' },
      { key: 'positionSize', label: 'Position Size (%)', type: 'number', default: 5, min: 3, max: 15, description: '% of capital per grid level' },
    ],
  },
  {
    id: 'scalper',
    name: 'Scalper',
    description: 'Takes small, frequent profits from tiny price movements. High win rate but small gains per trade.',
    category: 'Scalping',
    difficulty: 'INTERMEDIATE',
    params: [
      { key: 'takeProfit', label: 'Take Profit (%)', type: 'number', default: 0.08, min: 0.03, max: 0.3, description: 'Close position when profit reaches this %' },
      { key: 'stopLoss', label: 'Stop Loss (%)', type: 'number', default: 0.15, min: 0.05, max: 0.5, description: 'Close position when loss reaches this %' },
      { key: 'positionSize', label: 'Position Size (%)', type: 'number', default: 12, min: 5, max: 25, description: '% of capital per trade' },
    ],
  },
  {
    id: 'breakout',
    name: 'Breakout Hunter',
    description: 'Detects when price breaks out of a consolidation range and rides the move. Big wins, some false signals.',
    category: 'Breakout',
    difficulty: 'ADVANCED',
    params: [
      { key: 'consolidationPeriod', label: 'Consolidation Period', type: 'number', default: 25, min: 10, max: 60, description: 'Ticks to establish the range' },
      { key: 'breakoutThreshold', label: 'Breakout Threshold (%)', type: 'number', default: 0.2, min: 0.1, max: 0.5, description: '% above/below range to confirm breakout' },
      { key: 'positionSize', label: 'Position Size (%)', type: 'number', default: 15, min: 5, max: 25, description: '% of capital per trade' },
    ],
  },
  {
    id: 'dip-buyer',
    name: 'Dip Buyer',
    description: 'Waits for sharp drops then buys the dip. Patient strategy that aims for big reversals.',
    category: 'Value',
    difficulty: 'BEGINNER',
    params: [
      { key: 'dipThreshold', label: 'Dip Threshold (%)', type: 'number', default: 0.3, min: 0.1, max: 1.0, description: 'How far price must drop to trigger a buy' },
      { key: 'recoveryTarget', label: 'Recovery Target (%)', type: 'number', default: 0.15, min: 0.05, max: 0.5, description: 'How much recovery before selling' },
      { key: 'positionSize', label: 'Position Size (%)', type: 'number', default: 12, min: 5, max: 25, description: '% of capital per trade' },
    ],
  },
];

// ============================================================
// STRATEGY EXECUTION ENGINE
// ============================================================

interface StrategyState {
  priceHistory: Map<string, number[]>;
  positions: Map<string, { side: string; entryPrice: number; positionId: string }>;
  gridLevels?: Map<string, number[]>;
  lastTradeTime: number;
}

export class TemplateBotRunner {
  private states: Map<string, StrategyState> = new Map(); // botId -> state

  /**
   * Initialize state for a bot entering a match
   */
  init(botId: string): void {
    this.states.set(botId, {
      priceHistory: new Map(),
      positions: new Map(),
      lastTradeTime: -999,
    });
  }

  /**
   * Run one tick of strategy for a template bot
   */
  onTick(
    engine: MatchEngine,
    botId: string,
    templateId: string,
    params: Record<string, number>,
    tick: MarketTick,
  ): void {
    const state = this.states.get(botId);
    if (!state) return;

    const { symbol, price } = tick;

    // Track price history
    if (!state.priceHistory.has(symbol)) state.priceHistory.set(symbol, []);
    const history = state.priceHistory.get(symbol)!;
    history.push(price);
    if (history.length > 100) history.shift();

    // Rate limit (min 3 sec between trades per engine rules)
    const elapsed = engine.getElapsed();
    if (elapsed - state.lastTradeTime < 4) return;

    switch (templateId) {
      case 'momentum': this.runMomentum(engine, botId, params, symbol, price, history, state, elapsed); break;
      case 'mean-reversion': this.runMeanReversion(engine, botId, params, symbol, price, history, state, elapsed); break;
      case 'grid-trader': this.runGrid(engine, botId, params, symbol, price, history, state, elapsed); break;
      case 'scalper': this.runScalper(engine, botId, params, symbol, price, history, state, elapsed); break;
      case 'breakout': this.runBreakout(engine, botId, params, symbol, price, history, state, elapsed); break;
      case 'dip-buyer': this.runDipBuyer(engine, botId, params, symbol, price, history, state, elapsed); break;
    }
  }

  private runMomentum(engine: MatchEngine, botId: string, params: Record<string, number>, symbol: string, price: number, history: number[], state: StrategyState, elapsed: number): void {
    const lookback = params.lookback || 15;
    const threshold = params.threshold || 0.15;
    const sizePct = (params.positionSize || 10) / 100;
    if (history.length < lookback) return;

    const oldPrice = history[history.length - lookback];
    const changePct = ((price - oldPrice) / oldPrice) * 100;
    const posKey = `${botId}:${symbol}`;
    const existing = state.positions.get(posKey);

    if (changePct > threshold && !existing) {
      const result = engine.processOrder(botId, { symbol, side: 'LONG', action: 'OPEN', quantity: sizePct });
      if (result.success && result.tradeId) {
        state.positions.set(posKey, { side: 'LONG', entryPrice: price, positionId: result.tradeId });
        state.lastTradeTime = elapsed;
      }
    } else if (changePct < -threshold && existing?.side === 'LONG') {
      engine.processOrder(botId, { symbol, side: 'LONG', action: 'CLOSE', quantity: sizePct, positionId: existing.positionId });
      state.positions.delete(posKey);
      state.lastTradeTime = elapsed;
    } else if (changePct < -threshold && !existing) {
      const result = engine.processOrder(botId, { symbol, side: 'SHORT', action: 'OPEN', quantity: sizePct });
      if (result.success && result.tradeId) {
        state.positions.set(posKey, { side: 'SHORT', entryPrice: price, positionId: result.tradeId });
        state.lastTradeTime = elapsed;
      }
    } else if (changePct > threshold && existing?.side === 'SHORT') {
      engine.processOrder(botId, { symbol, side: 'SHORT', action: 'CLOSE', quantity: sizePct, positionId: existing.positionId });
      state.positions.delete(posKey);
      state.lastTradeTime = elapsed;
    }
  }

  private runMeanReversion(engine: MatchEngine, botId: string, params: Record<string, number>, symbol: string, price: number, history: number[], state: StrategyState, elapsed: number): void {
    const window = params.window || 20;
    const zThreshold = params.zThreshold || 1.2;
    const sizePct = (params.positionSize || 8) / 100;
    if (history.length < window) return;

    const slice = history.slice(-window);
    const mean = slice.reduce((s, p) => s + p, 0) / slice.length;
    const std = Math.sqrt(slice.reduce((s, p) => s + (p - mean) ** 2, 0) / slice.length);
    if (std === 0) return;

    const zScore = (price - mean) / std;
    const posKey = `${botId}:${symbol}`;
    const existing = state.positions.get(posKey);

    if (zScore < -zThreshold && !existing) {
      const result = engine.processOrder(botId, { symbol, side: 'LONG', action: 'OPEN', quantity: sizePct });
      if (result.success && result.tradeId) { state.positions.set(posKey, { side: 'LONG', entryPrice: price, positionId: result.tradeId }); state.lastTradeTime = elapsed; }
    } else if (zScore > zThreshold && !existing) {
      const result = engine.processOrder(botId, { symbol, side: 'SHORT', action: 'OPEN', quantity: sizePct });
      if (result.success && result.tradeId) { state.positions.set(posKey, { side: 'SHORT', entryPrice: price, positionId: result.tradeId }); state.lastTradeTime = elapsed; }
    } else if (existing && Math.abs(zScore) < 0.3) {
      engine.processOrder(botId, { symbol, side: existing.side as 'LONG' | 'SHORT', action: 'CLOSE', quantity: sizePct, positionId: existing.positionId });
      state.positions.delete(posKey);
      state.lastTradeTime = elapsed;
    }
  }

  private runGrid(engine: MatchEngine, botId: string, params: Record<string, number>, symbol: string, price: number, history: number[], state: StrategyState, elapsed: number): void {
    const spacing = (params.gridSpacing || 0.3) / 100;
    const sizePct = (params.positionSize || 5) / 100;
    if (history.length < 5) return;

    const basePrice = history[Math.floor(history.length / 2)]; // Use mid-history as anchor
    const posKey = `${botId}:${symbol}`;
    const existing = state.positions.get(posKey);

    const pctFromBase = (price - basePrice) / basePrice;

    if (pctFromBase < -spacing && !existing) {
      const result = engine.processOrder(botId, { symbol, side: 'LONG', action: 'OPEN', quantity: sizePct });
      if (result.success && result.tradeId) { state.positions.set(posKey, { side: 'LONG', entryPrice: price, positionId: result.tradeId }); state.lastTradeTime = elapsed; }
    } else if (pctFromBase > spacing && !existing) {
      const result = engine.processOrder(botId, { symbol, side: 'SHORT', action: 'OPEN', quantity: sizePct });
      if (result.success && result.tradeId) { state.positions.set(posKey, { side: 'SHORT', entryPrice: price, positionId: result.tradeId }); state.lastTradeTime = elapsed; }
    } else if (existing) {
      const pnlPct = existing.side === 'LONG'
        ? (price - existing.entryPrice) / existing.entryPrice
        : (existing.entryPrice - price) / existing.entryPrice;
      if (pnlPct > spacing * 0.5 || pnlPct < -spacing * 2) {
        engine.processOrder(botId, { symbol, side: existing.side as 'LONG' | 'SHORT', action: 'CLOSE', quantity: sizePct, positionId: existing.positionId });
        state.positions.delete(posKey);
        state.lastTradeTime = elapsed;
      }
    }
  }

  private runScalper(engine: MatchEngine, botId: string, params: Record<string, number>, symbol: string, price: number, history: number[], state: StrategyState, elapsed: number): void {
    const tp = (params.takeProfit || 0.08) / 100;
    const sl = (params.stopLoss || 0.15) / 100;
    const sizePct = (params.positionSize || 12) / 100;
    if (history.length < 3) return;

    const posKey = `${botId}:${symbol}`;
    const existing = state.positions.get(posKey);

    if (!existing) {
      // Enter based on very short-term momentum
      const recent = history.slice(-3);
      const micro = (recent[2] - recent[0]) / recent[0];
      if (Math.abs(micro) > 0.0001) {
        const side = micro > 0 ? 'LONG' : 'SHORT';
        const result = engine.processOrder(botId, { symbol, side, action: 'OPEN', quantity: sizePct });
        if (result.success && result.tradeId) { state.positions.set(posKey, { side, entryPrice: price, positionId: result.tradeId }); state.lastTradeTime = elapsed; }
      }
    } else {
      const pnlPct = existing.side === 'LONG'
        ? (price - existing.entryPrice) / existing.entryPrice
        : (existing.entryPrice - price) / existing.entryPrice;
      if (pnlPct >= tp || pnlPct <= -sl) {
        engine.processOrder(botId, { symbol, side: existing.side as 'LONG' | 'SHORT', action: 'CLOSE', quantity: sizePct, positionId: existing.positionId });
        state.positions.delete(posKey);
        state.lastTradeTime = elapsed;
      }
    }
  }

  private runBreakout(engine: MatchEngine, botId: string, params: Record<string, number>, symbol: string, price: number, history: number[], state: StrategyState, elapsed: number): void {
    const period = params.consolidationPeriod || 25;
    const threshold = (params.breakoutThreshold || 0.2) / 100;
    const sizePct = (params.positionSize || 15) / 100;
    if (history.length < period) return;

    const range = history.slice(-period);
    const high = Math.max(...range);
    const low = Math.min(...range);
    const rangeSize = (high - low) / low;

    const posKey = `${botId}:${symbol}`;
    const existing = state.positions.get(posKey);

    if (rangeSize < threshold * 3 && !existing) {
      // Tight consolidation — watch for breakout
      if (price > high * (1 + threshold)) {
        const result = engine.processOrder(botId, { symbol, side: 'LONG', action: 'OPEN', quantity: sizePct });
        if (result.success && result.tradeId) { state.positions.set(posKey, { side: 'LONG', entryPrice: price, positionId: result.tradeId }); state.lastTradeTime = elapsed; }
      } else if (price < low * (1 - threshold)) {
        const result = engine.processOrder(botId, { symbol, side: 'SHORT', action: 'OPEN', quantity: sizePct });
        if (result.success && result.tradeId) { state.positions.set(posKey, { side: 'SHORT', entryPrice: price, positionId: result.tradeId }); state.lastTradeTime = elapsed; }
      }
    } else if (existing) {
      const pnlPct = existing.side === 'LONG'
        ? (price - existing.entryPrice) / existing.entryPrice
        : (existing.entryPrice - price) / existing.entryPrice;
      if (pnlPct > threshold * 2 || pnlPct < -threshold) {
        engine.processOrder(botId, { symbol, side: existing.side as 'LONG' | 'SHORT', action: 'CLOSE', quantity: sizePct, positionId: existing.positionId });
        state.positions.delete(posKey);
        state.lastTradeTime = elapsed;
      }
    }
  }

  private runDipBuyer(engine: MatchEngine, botId: string, params: Record<string, number>, symbol: string, price: number, history: number[], state: StrategyState, elapsed: number): void {
    const dipThreshold = (params.dipThreshold || 0.3) / 100;
    const recoveryTarget = (params.recoveryTarget || 0.15) / 100;
    const sizePct = (params.positionSize || 12) / 100;
    if (history.length < 10) return;

    const recentHigh = Math.max(...history.slice(-10));
    const dropFromHigh = (recentHigh - price) / recentHigh;

    const posKey = `${botId}:${symbol}`;
    const existing = state.positions.get(posKey);

    if (dropFromHigh > dipThreshold && !existing) {
      const result = engine.processOrder(botId, { symbol, side: 'LONG', action: 'OPEN', quantity: sizePct });
      if (result.success && result.tradeId) { state.positions.set(posKey, { side: 'LONG', entryPrice: price, positionId: result.tradeId }); state.lastTradeTime = elapsed; }
    } else if (existing) {
      const gain = (price - existing.entryPrice) / existing.entryPrice;
      if (gain > recoveryTarget || gain < -dipThreshold * 1.5) {
        engine.processOrder(botId, { symbol, side: 'LONG', action: 'CLOSE', quantity: sizePct, positionId: existing.positionId });
        state.positions.delete(posKey);
        state.lastTradeTime = elapsed;
      }
    }
  }

  cleanup(botId: string): void {
    this.states.delete(botId);
  }
}

export const templateBotRunner = new TemplateBotRunner();
