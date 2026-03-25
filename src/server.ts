import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { config } from './lib/config';
import { rateLimit } from './api/middleware/rateLimit';
import { cacheMiddleware } from './lib/cache';

// Route imports
import authRoutes from './api/routes/auth';
import botRoutes from './api/routes/bots';
import matchRoutes from './api/routes/matches';
import userRoutes from './api/routes/users';
import leaderboardRoutes from './api/routes/leaderboards';
import seasonRoutes from './api/routes/seasons';
import tournamentRoutes from './api/routes/tournaments';
import challengeRoutes from './api/routes/challenges';
import clanRoutes from './api/routes/clans';
import sandboxRoutes from './api/routes/sandbox';
import billingRoutes from './api/routes/billing';
import retentionRoutes from './api/routes/retention';
import notificationRoutes from './api/routes/notifications';
import templateRoutes from './api/routes/templates';
import alpacaRoutes from './api/routes/alpaca';

// Service imports
import { MarketDataService } from './services/marketData';
import { MatchOrchestrator } from './services/matchOrchestrator';
import { BotWebSocketServer } from './services/botWebSocket';
import { SpectatorWebSocketServer } from './services/spectatorWebSocket';
import { houseBotService } from './services/houseBots';

const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.removeHeader('X-Powered-By');
  next();
});

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit);

// ============================================================
// ROUTES
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leaderboards', cacheMiddleware(10000), leaderboardRoutes); // 10s cache
app.use('/api/seasons', cacheMiddleware(30000), seasonRoutes); // 30s cache
app.use('/api/tournaments', cacheMiddleware(15000), tournamentRoutes); // 15s cache
app.use('/api/challenges', cacheMiddleware(30000), challengeRoutes); // 30s cache
app.use('/api/clans', clanRoutes);
app.use('/api/sandbox', sandboxRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/retention', retentionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/alpaca', alpacaRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    marketDataProvider: marketData.getProvider(),
    simulated: marketData.isUsingSimulatedData(),
    connectedBots: botWsServer?.getConnectedBotCount() ?? 0,
    spectators: spectatorWsServer?.getTotalSpectatorCount() ?? 0,
    queueStats: orchestrator?.getQueueStats() ?? null,
    activeMatches: orchestrator ? [...(orchestrator as any).activeMatches.keys()].length : 0,
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// START SERVER
// ============================================================

const server = createServer(app);

// Initialize services
const marketData = new MarketDataService();
const orchestrator = new MatchOrchestrator(marketData);
app.locals.orchestrator = orchestrator;
let botWsServer: BotWebSocketServer | null = null;
let spectatorWsServer: SpectatorWebSocketServer | null = null;

server.listen(config.port, () => {
  console.log(`
+================================================+
|         BOT TRADE ARENA -- Server              |
|                                                |
|  REST API:      http://localhost:${config.port}          |
|  Bot WS:        ws://localhost:${config.port}/bot-ws     |
|  Spectator WS:  ws://localhost:${config.port}/ws         |
|  Environment:   ${config.nodeEnv.padEnd(29)}|
+================================================+
  `);

  // Initialize house bots
  houseBotService.initialize().catch(err => console.error('[HouseBots] Init error:', err));

  // Start market data connection
  marketData.connect();

  // Start match orchestrator
  orchestrator.start();

  // Start WebSocket servers
  botWsServer = new BotWebSocketServer(server, orchestrator);
  spectatorWsServer = new SpectatorWebSocketServer(server, orchestrator);

  console.log(`[Server] Listening on port ${config.port}`);
  console.log(`[Server] 60+ REST endpoints active`);
  console.log(`[Server] Bot WS + Spectator WS active`);
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  console.log('\n[Server] Shutting down...');
  orchestrator.stop();
  marketData.disconnect();
  if (botWsServer) botWsServer.close();
  if (spectatorWsServer) spectatorWsServer.close();
  server.close(() => {
    console.log('[Server] Goodbye.');
    process.exit(0);
  });
}

export { app, server, orchestrator, marketData };
