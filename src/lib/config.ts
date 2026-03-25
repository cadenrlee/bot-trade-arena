import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  marketProvider: (process.env.MARKET_DATA_PROVIDER || 'auto') as 'binance' | 'alpaca' | 'auto' | 'simulated',

  binance: {
    wsUrl: process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws',
  },

  alpaca: {
    apiKey: process.env.ALPACA_API_KEY || '',
    apiSecret: process.env.ALPACA_API_SECRET || '',
    wsUrl: process.env.ALPACA_WS_URL || 'wss://stream.data.alpaca.markets/v1beta3/crypto/us',
    feed: process.env.ALPACA_FEED || 'us', // 'us' or 'sip'
  },

  symbols: (process.env.DEFAULT_SYMBOLS || 'btcusdt,ethusdt,solusdt').split(','),
  stockSymbols: (process.env.STOCK_SYMBOLS || 'AAPL,TSLA,NVDA,MSFT,AMZN,SPY,QQQ,META').split(','),

  match: {
    duration: parseInt(process.env.DEFAULT_MATCH_DURATION || '300', 10),
    startingCapital: parseInt(process.env.DEFAULT_STARTING_CAPITAL || '100000', 10),
    maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS || '5', 10),
    maxPositionPct: parseFloat(process.env.MAX_POSITION_PCT || '0.3'),
    minTradeInterval: parseInt(process.env.MIN_TRADE_INTERVAL || '3', 10),
    snapshotInterval: parseInt(process.env.SNAPSHOT_INTERVAL || '5', 10),
  },

  rateLimit: {
    window: parseInt(process.env.API_RATE_LIMIT_WINDOW || '60000', 10),
    maxFree: parseInt(process.env.API_RATE_LIMIT_MAX_FREE || '30', 10),
    maxPaid: parseInt(process.env.API_RATE_LIMIT_MAX_PAID || '120', 10),
  },
};
