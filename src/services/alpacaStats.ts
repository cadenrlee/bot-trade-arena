/**
 * Alpaca Stats Service
 *
 * Pulls real trading performance from users' Alpaca accounts:
 *   - Account equity, buying power, P&L
 *   - Trade history, win rate, avg gain/loss
 *   - Portfolio performance over time
 *   - Position breakdown
 *
 * Also handles market hours detection for stock matches.
 */

interface AlpacaAccount {
  equity: number;
  buying_power: number;
  cash: number;
  portfolio_value: number;
  last_equity: number;
  long_market_value: number;
  short_market_value: number;
  daytrade_count: number;
  daytrading_buying_power: number;
}

interface AlpacaOrder {
  id: string;
  symbol: string;
  side: string;
  qty: string;
  filled_avg_price: string;
  status: string;
  submitted_at: string;
  filled_at: string;
  type: string;
}

interface AlpacaPortfolioHistory {
  timestamp: number[];
  equity: number[];
  profit_loss: number[];
  profit_loss_pct: number[];
}

interface UserTradingStats {
  // Account
  equity: number;
  buyingPower: number;
  cash: number;
  portfolioValue: number;
  todayPnl: number;
  todayPnlPct: number;
  daytradeCount: number;

  // Performance (calculated from orders)
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  totalPnl: number;
  bestTrade: number;
  worstTrade: number;

  // Recent trades
  recentTrades: {
    symbol: string;
    side: string;
    qty: number;
    price: number;
    pnl?: number;
    time: string;
  }[];

  // Equity curve
  equityCurve: { date: string; equity: number; pnl: number }[];

  // Top symbols
  topSymbols: { symbol: string; trades: number; pnl: number }[];

  // Market status
  marketOpen: boolean;
  nextOpen: string | null;
  nextClose: string | null;
}

const ALPACA_PAPER_URL = 'https://paper-api.alpaca.markets';
const ALPACA_DATA_URL = 'https://data.alpaca.markets';

export class AlpacaStatsService {

  /**
   * Fetch full trading stats for a user's Alpaca account
   */
  async getStats(apiKey: string, apiSecret: string): Promise<UserTradingStats> {
    const headers = {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
    };

    // Fetch in parallel
    const [account, orders, history, clock] = await Promise.all([
      this.fetchAccount(headers),
      this.fetchOrders(headers),
      this.fetchPortfolioHistory(headers),
      this.fetchClock(headers),
    ]);

    // Calculate trade stats
    const tradeStats = this.calculateTradeStats(orders);

    // Build equity curve
    const equityCurve = history.timestamp.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      equity: history.equity[i],
      pnl: history.profit_loss[i],
    }));

    // Top symbols
    const symbolMap = new Map<string, { trades: number; pnl: number }>();
    for (const order of orders) {
      if (order.status !== 'filled') continue;
      const existing = symbolMap.get(order.symbol) || { trades: 0, pnl: 0 };
      existing.trades++;
      symbolMap.set(order.symbol, existing);
    }
    const topSymbols = Array.from(symbolMap.entries())
      .map(([symbol, data]) => ({ symbol, ...data }))
      .sort((a, b) => b.trades - a.trades)
      .slice(0, 10);

    const todayPnl = account.equity - account.last_equity;
    const todayPnlPct = account.last_equity > 0 ? (todayPnl / account.last_equity) * 100 : 0;

    return {
      equity: account.equity,
      buyingPower: account.buying_power,
      cash: account.cash,
      portfolioValue: account.portfolio_value,
      todayPnl,
      todayPnlPct,
      daytradeCount: account.daytrade_count,

      ...tradeStats,

      recentTrades: orders
        .filter((o: AlpacaOrder) => o.status === 'filled')
        .slice(0, 20)
        .map((o: AlpacaOrder) => ({
          symbol: o.symbol,
          side: o.side,
          qty: parseFloat(o.qty),
          price: parseFloat(o.filled_avg_price),
          time: o.filled_at,
        })),

      equityCurve,
      topSymbols,

      marketOpen: clock.is_open,
      nextOpen: clock.next_open,
      nextClose: clock.next_close,
    };
  }

  /**
   * Check if US stock market is currently open
   */
  async isMarketOpen(apiKey: string, apiSecret: string): Promise<{
    isOpen: boolean;
    nextOpen: string | null;
    nextClose: string | null;
    minutesUntilClose?: number;
  }> {
    const headers = {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
    };
    const clock = await this.fetchClock(headers);

    let minutesUntilClose: number | undefined;
    if (clock.is_open && clock.next_close) {
      const closeTime = new Date(clock.next_close).getTime();
      minutesUntilClose = Math.floor((closeTime - Date.now()) / 60000);
    }

    return {
      isOpen: clock.is_open,
      nextOpen: clock.next_open,
      nextClose: clock.next_close,
      minutesUntilClose,
    };
  }

  /**
   * Get real-time stock quotes for match symbols
   */
  async getStockQuotes(apiKey: string, apiSecret: string, symbols: string[]): Promise<Record<string, number>> {
    const headers = {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
    };

    const symStr = symbols.join(',');
    const res = await fetch(`${ALPACA_DATA_URL}/v2/stocks/trades/latest?symbols=${symStr}&feed=iex`, { headers });
    if (!res.ok) return {};

    const data: any = await res.json();
    const prices: Record<string, number> = {};
    for (const [sym, trade] of Object.entries(data.trades || {})) {
      prices[sym] = (trade as any).p;
    }
    return prices;
  }

  // ============================================================
  // PRIVATE FETCH METHODS
  // ============================================================

  private async fetchAccount(headers: Record<string, string>): Promise<AlpacaAccount> {
    try {
      const res = await fetch(`${ALPACA_PAPER_URL}/v2/account`, { headers });
      if (!res.ok) throw new Error(`Account fetch failed: ${res.status}`);
      const data: any = await res.json();
      return {
        equity: parseFloat(data.equity),
        buying_power: parseFloat(data.buying_power),
        cash: parseFloat(data.cash),
        portfolio_value: parseFloat(data.portfolio_value),
        last_equity: parseFloat(data.last_equity),
        long_market_value: parseFloat(data.long_market_value),
        short_market_value: parseFloat(data.short_market_value),
        daytrade_count: data.daytrade_count || 0,
        daytrading_buying_power: parseFloat(data.daytrading_buying_power || '0'),
      };
    } catch {
      return {
        equity: 0, buying_power: 0, cash: 0, portfolio_value: 0,
        last_equity: 0, long_market_value: 0, short_market_value: 0,
        daytrade_count: 0, daytrading_buying_power: 0,
      };
    }
  }

  private async fetchOrders(headers: Record<string, string>): Promise<AlpacaOrder[]> {
    try {
      const res = await fetch(`${ALPACA_PAPER_URL}/v2/orders?status=closed&limit=500&direction=desc`, { headers });
      if (!res.ok) return [];
      return await res.json() as AlpacaOrder[];
    } catch {
      return [];
    }
  }

  private async fetchPortfolioHistory(headers: Record<string, string>): Promise<AlpacaPortfolioHistory> {
    try {
      const res = await fetch(`${ALPACA_PAPER_URL}/v2/account/portfolio/history?period=1M&timeframe=1D`, { headers });
      if (!res.ok) return { timestamp: [], equity: [], profit_loss: [], profit_loss_pct: [] };
      return await res.json() as AlpacaPortfolioHistory;
    } catch {
      return { timestamp: [], equity: [], profit_loss: [], profit_loss_pct: [] };
    }
  }

  private async fetchClock(headers: Record<string, string>): Promise<any> {
    try {
      const res = await fetch(`${ALPACA_PAPER_URL}/v2/clock`, { headers });
      if (!res.ok) return { is_open: false, next_open: null, next_close: null };
      return await res.json();
    } catch {
      return { is_open: false, next_open: null, next_close: null };
    }
  }

  private calculateTradeStats(orders: AlpacaOrder[]) {
    const filled = orders.filter(o => o.status === 'filled');

    // Group by symbol to calculate P&L per round trip
    // Simple approach: pair buys with sells
    const pnls: number[] = [];
    const symbolPositions = new Map<string, { qty: number; avgPrice: number; side: string }>();

    for (const order of filled.reverse()) { // chronological order
      const qty = parseFloat(order.qty);
      const price = parseFloat(order.filled_avg_price);
      const existing = symbolPositions.get(order.symbol);

      if (!existing) {
        symbolPositions.set(order.symbol, { qty, avgPrice: price, side: order.side });
      } else if (existing.side !== order.side) {
        // Closing trade — calculate P&L
        const pnl = existing.side === 'buy'
          ? (price - existing.avgPrice) * Math.min(qty, existing.qty)
          : (existing.avgPrice - price) * Math.min(qty, existing.qty);
        pnls.push(pnl);

        const remaining = existing.qty - qty;
        if (remaining > 0) {
          symbolPositions.set(order.symbol, { ...existing, qty: remaining });
        } else {
          symbolPositions.delete(order.symbol);
        }
      } else {
        // Adding to position
        const totalQty = existing.qty + qty;
        const avgPrice = (existing.avgPrice * existing.qty + price * qty) / totalQty;
        symbolPositions.set(order.symbol, { qty: totalQty, avgPrice, side: existing.side });
      }
    }

    const wins = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);
    const grossProfit = wins.reduce((s, p) => s + p, 0);
    const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));

    return {
      totalTrades: pnls.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: pnls.length > 0 ? (wins.length / pnls.length) * 100 : 0,
      avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
      avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 0,
      totalPnl: pnls.reduce((s, p) => s + p, 0),
      bestTrade: pnls.length > 0 ? Math.max(...pnls) : 0,
      worstTrade: pnls.length > 0 ? Math.min(...pnls) : 0,
    };
  }
}

export const alpacaStatsService = new AlpacaStatsService();
