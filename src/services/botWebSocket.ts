import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import prisma from '../lib/prisma';
import { MatchOrchestrator } from './matchOrchestrator';
import type { MarketTick } from '../engine/match';

interface AuthenticatedBotWs extends WebSocket {
  botId?: string;
  userId?: string;
  apiKey?: string;
  elo?: number;
  isAlive?: boolean;
}

/**
 * WebSocket server for bot connections.
 * Path: /bot-ws
 *
 * Flow: Connect -> Auth via API key -> Queue for match -> Receive market ticks -> Send orders -> Get results
 */
export class BotWebSocketServer {
  private wss: WebSocketServer;
  private orchestrator: MatchOrchestrator;
  private connectedBots: Map<string, AuthenticatedBotWs> = new Map(); // botId -> ws
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(server: Server, orchestrator: MatchOrchestrator) {
    this.orchestrator = orchestrator;
    this.wss = new WebSocketServer({ server, path: '/bot-ws' });

    this.wss.on('connection', (ws: AuthenticatedBotWs) => {
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', (data) => this.handleMessage(ws, data.toString()));
      ws.on('close', () => this.handleDisconnect(ws));
      ws.on('error', (err) => console.error('[BotWS] Socket error:', err.message));

      // Bot must authenticate within 10 seconds
      const authTimeout = setTimeout(() => {
        if (!ws.botId) {
          this.send(ws, { type: 'error', data: { message: 'Authentication timeout' } });
          ws.close();
        }
      }, 10000);
      (ws as any)._authTimeout = authTimeout;
    });

    // Keepalive pings
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const botWs = ws as AuthenticatedBotWs;
        if (!botWs.isAlive) { botWs.terminate(); return; }
        botWs.isAlive = false;
        botWs.ping();
      });
    }, 30000);

    // Forward match events to bots
    this.setupOrchestratorEvents();
  }

  private async handleMessage(ws: AuthenticatedBotWs, raw: string): Promise<void> {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.send(ws, { type: 'error', data: { message: 'Invalid JSON' } });
      return;
    }

    switch (msg.type) {
      case 'auth':
        await this.handleAuth(ws, msg.apiKey);
        break;
      case 'queue':
        this.handleQueue(ws, msg.mode);
        break;
      case 'order':
        this.handleOrder(ws, msg.data);
        break;
      default:
        this.send(ws, { type: 'error', data: { message: `Unknown message type: ${msg.type}` } });
    }
  }

  private async handleAuth(ws: AuthenticatedBotWs, apiKey: string): Promise<void> {
    if (!apiKey) {
      this.send(ws, { type: 'error', data: { message: 'API key required' } });
      return;
    }

    const bot = await prisma.bot.findUnique({ where: { apiKey } });
    if (!bot) {
      this.send(ws, { type: 'error', data: { message: 'Invalid API key' } });
      ws.close();
      return;
    }

    // Clear auth timeout
    if ((ws as any)._authTimeout) {
      clearTimeout((ws as any)._authTimeout);
    }

    ws.botId = bot.id;
    ws.userId = bot.userId;
    ws.apiKey = apiKey;
    ws.elo = bot.elo;

    // Disconnect previous connection for this bot if any
    const existing = this.connectedBots.get(bot.id);
    if (existing && existing !== ws) {
      this.send(existing, { type: 'error', data: { message: 'Another connection opened' } });
      existing.close();
    }

    this.connectedBots.set(bot.id, ws);

    await prisma.bot.update({
      where: { id: bot.id },
      data: { status: 'CONNECTED', lastConnected: new Date() },
    });

    this.send(ws, {
      type: 'auth:success',
      data: {
        botId: bot.id,
        name: bot.name,
        elo: bot.elo,
      },
    });

    console.log(`[BotWS] Bot ${bot.name} (${bot.id}) authenticated`);
  }

  private handleQueue(ws: AuthenticatedBotWs, mode?: string): void {
    if (!ws.botId || !ws.userId) {
      this.send(ws, { type: 'error', data: { message: 'Not authenticated' } });
      return;
    }

    this.orchestrator.queueBot({
      botId: ws.botId,
      userId: ws.userId,
      apiKey: ws.apiKey!,
      elo: ws.elo!,
      ws,
    });

    this.send(ws, { type: 'queue:joined', data: { message: 'Searching for opponent...' } });
  }

  private handleOrder(ws: AuthenticatedBotWs, data: any): void {
    if (!ws.botId) {
      this.send(ws, { type: 'error', data: { message: 'Not authenticated' } });
      return;
    }

    const match = this.orchestrator.getMatchForBot(ws.botId);
    if (!match) {
      this.send(ws, { type: 'order:result', data: { success: false, error: 'Not in a match' } });
      return;
    }

    const result = match.processOrder(ws.botId, {
      symbol: data.symbol,
      side: data.side,
      action: data.action,
      quantity: data.quantity,
      positionId: data.positionId,
    });

    this.send(ws, { type: 'order:result', data: result });
  }

  private handleDisconnect(ws: AuthenticatedBotWs): void {
    if (ws.botId) {
      this.connectedBots.delete(ws.botId);
      this.orchestrator.dequeueBot(ws.botId);

      prisma.bot.update({
        where: { id: ws.botId },
        data: { status: 'INACTIVE' },
      }).catch(() => {});

      console.log(`[BotWS] Bot ${ws.botId} disconnected`);
    }
  }

  private setupOrchestratorEvents(): void {
    // Notify bots when match is created
    this.orchestrator.on('match:created', ({ matchId, bot1Id, bot2Id, config }) => {
      const ws1 = this.connectedBots.get(bot1Id);
      const ws2 = this.connectedBots.get(bot2Id);

      const startData = {
        matchId,
        duration: config.duration,
        symbols: config.symbols,
        capital: config.startingCapital,
      };

      if (ws1) this.send(ws1, { type: 'match:start', data: { ...startData, opponent: bot2Id } });
      if (ws2) this.send(ws2, { type: 'match:start', data: { ...startData, opponent: bot1Id } });
    });

    // Forward market ticks to bots in matches
    this.orchestrator.on('match:tick', (data) => {
      // Find bots in this match and send them the tick data with per-symbol ticks
      const match = this.orchestrator.getActiveMatch(data.matchId);
      if (!match) return;
      const cfg = match.getConfig();

      // Send ticks as individual market:tick events
      if (data.prices) {
        for (const [symbol, price] of Object.entries(data.prices)) {
          const tickData = { symbol, price, volume: 0, timestamp: Date.now() };

          // Find bots via config — we need the match's bot IDs
          // The tick data has bot1/bot2 info, we use it to find the WS connections
          if (data.bot1) {
            const ws1 = this.connectedBots.get(data.bot1.botId);
            if (ws1) this.send(ws1, { type: 'market:tick', data: tickData });
          }
          if (data.bot2) {
            const ws2 = this.connectedBots.get(data.bot2.botId);
            if (ws2) this.send(ws2, { type: 'market:tick', data: tickData });
          }
        }
      }

      // Send state updates
      if (data.bot1) {
        const ws1 = this.connectedBots.get(data.bot1.botId);
        if (ws1) this.send(ws1, { type: 'state:update', data: data.bot1 });
      }
      if (data.bot2) {
        const ws2 = this.connectedBots.get(data.bot2.botId);
        if (ws2) this.send(ws2, { type: 'state:update', data: data.bot2 });
      }
    });

    // Notify bots when match ends
    this.orchestrator.on('match:ended', ({ matchId, result }) => {
      const ws1 = this.connectedBots.get(result.bot1.botId);
      const ws2 = this.connectedBots.get(result.bot2.botId);

      if (ws1) {
        this.send(ws1, {
          type: 'match:end',
          data: {
            winner: result.winner,
            matchId,
            score: result.bot1.score,
            eloChange: result.bot1.eloChange,
            newElo: result.bot1.newElo,
          },
        });
      }
      if (ws2) {
        this.send(ws2, {
          type: 'match:end',
          data: {
            winner: result.winner,
            matchId,
            score: result.bot2.score,
            eloChange: result.bot2.eloChange,
            newElo: result.bot2.newElo,
          },
        });
      }
    });
  }

  private send(ws: WebSocket, msg: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  getConnectedBotCount(): number {
    return this.connectedBots.size;
  }

  close(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.wss.close();
  }
}
