import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { config } from '../lib/config';
import type { MarketTick } from '../engine/match';

/**
 * Market Data Service — multi-provider with automatic fallback.
 *
 * Priority order (configurable via MARKET_DATA_PROVIDER env):
 *   1. "alpaca"   — Alpaca crypto/stock WebSocket (free with API key)
 *   2. "binance"  — Binance crypto WebSocket (free, no key needed)
 *   3. "auto"     — Try Alpaca → Binance → Simulated
 *   4. "simulated" �� Geometric Brownian motion (always works)
 */

// ============================================================
// SYMBOL MAPPING
// ============================================================

// Map between internal symbols and provider-specific formats
const ALPACA_SYMBOL_MAP: Record<string, string> = {
  'btcusdt': 'BTC/USD', 'ethusdt': 'ETH/USD', 'solusdt': 'SOL/USD',
  'bnbusdt': 'BNB/USD', 'xrpusdt': 'XRP/USD', 'dogeusdt': 'DOGE/USD',
  'BTCUSDT': 'BTC/USD', 'ETHUSDT': 'ETH/USD', 'SOLUSDT': 'SOL/USD',
  'BNBUSDT': 'BNB/USD', 'XRPUSDT': 'XRP/USD', 'DOGEUSDT': 'DOGE/USD',
};

const ALPACA_REVERSE_MAP: Record<string, string> = {};
for (const [k, v] of Object.entries(ALPACA_SYMBOL_MAP)) {
  ALPACA_REVERSE_MAP[v] = k.toUpperCase();
}

// Simulation config
const SYMBOL_CONFIG: Record<string, { price: number; volatility: number; drift: number }> = {
  BTCUSDT:  { price: 67500,  volatility: 0.0004,  drift: 0.000002 },
  ETHUSDT:  { price: 3200,   volatility: 0.0005,  drift: 0.000003 },
  SOLUSDT:  { price: 145,    volatility: 0.0008,  drift: 0.000001 },
  BNBUSDT:  { price: 580,    volatility: 0.0005,  drift: 0.000002 },
  XRPUSDT:  { price: 0.62,   volatility: 0.0007,  drift: 0.000001 },
  DOGEUSDT: { price: 0.145,  volatility: 0.001,   drift: 0.0 },
};

export class MarketDataService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private symbols: string[];
  private latestPrices: Map<string, number> = new Map();
  private failCount = 0;
  private simInterval: NodeJS.Timeout | null = null;
  private isSimulated = false;
  private activeProvider: 'alpaca' | 'binance' | 'simulated' | 'none' = 'none';

  constructor(symbols?: string[]) {
    super();
    this.symbols = symbols || config.symbols;
  }

  connect(): void {
    const provider = config.marketProvider;

    if (provider === 'alpaca') {
      this.tryAlpaca();
    } else if (provider === 'binance') {
      this.tryBinance();
    } else if (provider === 'simulated') {
      this.startSimulation();
    } else {
      // auto: try Alpaca first if keys exist, then Binance, then simulated
      if (config.alpaca.apiKey) {
        this.tryAlpaca();
      } else {
        this.tryBinance();
      }
    }
  }

  // ============================================================
  // ALPACA PROVIDER
  // ============================================================

  private tryAlpaca(): void {
    if (!config.alpaca.apiKey || !config.alpaca.apiSecret) {
      console.log('[MarketData] No Alpaca API keys — falling back');
      this.onAlpacaFail();
      return;
    }

    const url = config.alpaca.wsUrl;
    console.log(`[MarketData] Connecting to Alpaca: ${this.symbols.join(', ')}`);

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.onAlpacaFail();
      return;
    }

    const connectTimeout = setTimeout(() => {
      if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        this.ws.terminate();
        this.onAlpacaFail();
      }
    }, 10000);

    this.ws.on('open', () => {
      clearTimeout(connectTimeout);

      // Alpaca auth message
      this.ws!.send(JSON.stringify({
        action: 'auth',
        key: config.alpaca.apiKey,
        secret: config.alpaca.apiSecret,
      }));
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const messages = JSON.parse(data.toString());
        for (const msg of Array.isArray(messages) ? messages : [messages]) {
          if (msg.T === 'success' && msg.msg === 'authenticated') {
            // Subscribe to trades
            const alpacaSymbols = this.symbols
              .map(s => ALPACA_SYMBOL_MAP[s])
              .filter(Boolean);

            this.ws!.send(JSON.stringify({
              action: 'subscribe',
              trades: alpacaSymbols,
            }));

            this.failCount = 0;
            this.isSimulated = false;
            this.activeProvider = 'alpaca';
            console.log(`[MarketData] Connected to Alpaca — LIVE prices (${alpacaSymbols.join(', ')})`);
            this.emit('connected');
          }

          if (msg.T === 'error') {
            console.error('[MarketData] Alpaca error:', msg.msg);
            this.onAlpacaFail();
          }

          // Trade message
          if (msg.T === 't') {
            const internalSymbol = ALPACA_REVERSE_MAP[msg.S];
            if (internalSymbol) {
              const tick: MarketTick = {
                symbol: internalSymbol,
                price: msg.p,
                volume: msg.s || 0,
                timestamp: new Date(msg.t).getTime(),
              };
              this.latestPrices.set(internalSymbol, tick.price);
              this.emit('tick', tick);
            }
          }

          // Subscription confirmation
          if (msg.T === 'subscription') {
            console.log(`[MarketData] Alpaca subscribed to: ${(msg.trades || []).join(', ')}`);
          }
        }
      } catch { /* ignore malformed */ }
    });

    this.ws.on('error', () => {
      clearTimeout(connectTimeout);
      this.onAlpacaFail();
    });

    this.ws.on('close', () => {
      clearTimeout(connectTimeout);
      if (this.activeProvider === 'alpaca') {
        console.log('[MarketData] Alpaca disconnected, reconnecting...');
        this.scheduleReconnect('alpaca');
      }
    });
  }

  private onAlpacaFail(): void {
    this.failCount++;
    if (this.ws) { this.ws.removeAllListeners(); this.ws.close(); this.ws = null; }

    if (config.marketProvider === 'alpaca') {
      // Explicitly set to Alpaca — retry then fall to simulated
      if (this.failCount >= 3) {
        console.log('[MarketData] Alpaca unavailable after 3 attempts — switching to simulated');
        this.startSimulation();
      } else {
        this.scheduleReconnect('alpaca');
      }
    } else {
      // Auto mode — try Binance next
      console.log('[MarketData] Alpaca failed — trying Binance...');
      this.failCount = 0;
      this.tryBinance();
    }
  }

  // ============================================================
  // BINANCE PROVIDER
  // ============================================================

  private tryBinance(): void {
    const streams = this.symbols.map(s => `${s.toLowerCase()}@trade`).join('/');
    const url = `${config.binance.wsUrl}/${streams}`;

    console.log(`[MarketData] Connecting to Binance: ${this.symbols.join(', ')}`);

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.onBinanceFail();
      return;
    }

    const connectTimeout = setTimeout(() => {
      if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        this.ws.terminate();
        this.onBinanceFail();
      }
    }, 8000);

    this.ws.on('open', () => {
      clearTimeout(connectTimeout);
      this.failCount = 0;
      this.isSimulated = false;
      this.activeProvider = 'binance';
      console.log('[MarketData] Connected to Binance — LIVE prices');
      this.emit('connected');
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        const tick: MarketTick = {
          symbol: msg.s,
          price: parseFloat(msg.p),
          volume: parseFloat(msg.q),
          timestamp: msg.T,
        };
        this.latestPrices.set(tick.symbol, tick.price);
        this.emit('tick', tick);
      } catch { /* ignore */ }
    });

    this.ws.on('error', () => {
      clearTimeout(connectTimeout);
      this.onBinanceFail();
    });

    this.ws.on('close', () => {
      clearTimeout(connectTimeout);
      if (this.activeProvider === 'binance') {
        this.scheduleReconnect('binance');
      } else if (!this.isSimulated) {
        this.onBinanceFail();
      }
    });
  }

  private onBinanceFail(): void {
    this.failCount++;
    if (this.ws) { this.ws.removeAllListeners(); this.ws.close(); this.ws = null; }

    if (this.failCount >= 2 && !this.isSimulated) {
      console.log('[MarketData] Binance unavailable — switching to SIMULATED prices');
      this.startSimulation();
    } else if (!this.isSimulated) {
      console.log(`[MarketData] Binance failed (attempt ${this.failCount}), retrying in 3s...`);
      this.scheduleReconnect('binance');
    }
  }

  // ============================================================
  // SIMULATED PROVIDER (Geometric Brownian Motion)
  // ============================================================

  private startSimulation(): void {
    this.isSimulated = true;
    this.activeProvider = 'simulated';
    if (this.ws) { this.ws.removeAllListeners(); this.ws.close(); this.ws = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

    for (const sym of this.symbols) {
      const key = sym.toUpperCase();
      const cfg = SYMBOL_CONFIG[key];
      if (cfg && !this.latestPrices.has(key)) {
        this.latestPrices.set(key, cfg.price);
      }
    }

    let tickCount = 0;
    let btcMomentum = 0;

    this.simInterval = setInterval(() => {
      tickCount++;
      const isVolatile = Math.sin(tickCount / 30) > 0.7 || Math.random() < 0.02;
      const volMultiplier = isVolatile ? 2.5 : 1.0;
      btcMomentum = btcMomentum * 0.95 + (Math.random() - 0.5) * 0.001;

      for (const sym of this.symbols) {
        const key = sym.toUpperCase();
        const cfg = SYMBOL_CONFIG[key] || { price: 100, volatility: 0.0005, drift: 0 };
        const currentPrice = this.latestPrices.get(key) || cfg.price;

        const randomShock = (Math.random() - 0.5) * 2;
        const vol = cfg.volatility * volMultiplier;
        const deviation = (currentPrice - cfg.price) / cfg.price;
        const meanReversion = -deviation * 0.001;
        const btcInfluence = key === 'BTCUSDT' ? 0 : btcMomentum * 0.6;
        const change = cfg.drift + meanReversion + btcInfluence + randomShock * vol;
        const newPrice = Math.max(currentPrice * 0.5, currentPrice * (1 + change));

        const baseVolume = key === 'BTCUSDT' ? 0.5 : key === 'ETHUSDT' ? 2 : 50;
        const volume = baseVolume * (0.5 + Math.random()) * (isVolatile ? 3 : 1);

        const tick: MarketTick = {
          symbol: key,
          price: Math.round(newPrice * 100) / 100,
          volume: Math.round(volume * 10000) / 10000,
          timestamp: Date.now(),
        };

        this.latestPrices.set(key, tick.price);
        this.emit('tick', tick);
      }
    }, 1000);

    this.emit('connected');
    console.log(`[MarketData] Simulated market running — ${this.symbols.length} symbols @ 1 tick/sec`);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  getPrice(symbol: string): number | undefined {
    return this.latestPrices.get(symbol.toUpperCase()) || this.latestPrices.get(symbol);
  }

  getAllPrices(): Map<string, number> {
    return new Map(this.latestPrices);
  }

  getProvider(): string {
    return this.activeProvider;
  }

  isUsingSimulatedData(): boolean {
    return this.isSimulated;
  }

  private scheduleReconnect(provider: 'alpaca' | 'binance'): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (provider === 'alpaca') this.tryAlpaca();
      else this.tryBinance();
    }, 3000);
  }

  disconnect(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.simInterval) { clearInterval(this.simInterval); this.simInterval = null; }
    if (this.ws) { this.ws.removeAllListeners(); this.ws.close(); this.ws = null; }
    this.activeProvider = 'none';
  }
}
