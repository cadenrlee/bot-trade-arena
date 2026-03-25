import { WebSocket, WebSocketServer } from 'ws';
import type { Server, IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../lib/config';
import { MatchOrchestrator } from './matchOrchestrator';

interface SpectatorWs extends WebSocket {
  userId?: string;
  username?: string;
  isAlive?: boolean;
  subscriptions?: Set<string>; // room keys like "match:abc", "queue", "leaderboard:daily"
}

interface IncomingSpectatorMessage {
  type: string;
  matchId?: string;
  period?: string;
  token?: string;
}

type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'allTime';

const VALID_PERIODS: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'allTime'];

/**
 * WebSocket server for spectators and authenticated users watching live matches.
 * Path: /ws
 *
 * Supports room-based subscriptions for matches, queue updates, and leaderboard changes.
 * Authentication is optional — unauthenticated users can spectate freely.
 */
export class SpectatorWebSocketServer {
  private wss: WebSocketServer;
  private orchestrator: MatchOrchestrator;
  private rooms: Map<string, Set<SpectatorWs>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(server: Server, orchestrator: MatchOrchestrator) {
    this.orchestrator = orchestrator;

    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: SpectatorWs, req: IncomingMessage) => {
      ws.isAlive = true;
      ws.subscriptions = new Set();

      // Attempt auth from query string token (optional)
      this.tryAuthFromRequest(ws, req);

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        this.handleMessage(ws, data.toString());
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (err) => {
        console.error('[SpectatorWS] Socket error:', err.message);
      });

      // Send welcome
      this.send(ws, {
        type: 'connected',
        data: {
          authenticated: !!ws.userId,
          userId: ws.userId || null,
        },
      });
    });

    // Keepalive ping every 30 seconds
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const spectator = ws as SpectatorWs;
        if (!spectator.isAlive) {
          spectator.terminate();
          return;
        }
        spectator.isAlive = false;
        spectator.ping();
      });
    }, 30000);

    this.setupOrchestratorEvents();
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  private tryAuthFromRequest(ws: SpectatorWs, req: IncomingMessage): void {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      if (token) {
        this.authenticate(ws, token);
      }
    } catch {
      // Ignore — unauthenticated spectator
    }
  }

  private authenticate(ws: SpectatorWs, token: string): boolean {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as {
        sub?: string;
        userId?: string;
        username?: string;
      };
      ws.userId = payload.sub || payload.userId;
      ws.username = payload.username;
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Message handling
  // ---------------------------------------------------------------------------

  private handleMessage(ws: SpectatorWs, raw: string): void {
    let msg: IncomingSpectatorMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.send(ws, { type: 'error', data: { message: 'Invalid JSON' } });
      return;
    }

    switch (msg.type) {
      case 'auth':
        this.handleAuth(ws, msg.token);
        break;

      case 'subscribe:match':
        this.handleSubscribeMatch(ws, msg.matchId);
        break;

      case 'unsubscribe:match':
        this.handleUnsubscribeMatch(ws, msg.matchId);
        break;

      case 'subscribe:queue':
        this.joinRoom(ws, 'queue');
        this.send(ws, { type: 'subscribed', data: { room: 'queue' } });
        break;

      case 'unsubscribe:queue':
        this.leaveRoom(ws, 'queue');
        this.send(ws, { type: 'unsubscribed', data: { room: 'queue' } });
        break;

      case 'subscribe:leaderboard':
        this.handleSubscribeLeaderboard(ws, msg.period);
        break;

      case 'unsubscribe:leaderboard':
        this.handleUnsubscribeLeaderboard(ws, msg.period);
        break;

      case 'ping':
        this.send(ws, { type: 'pong', data: { ts: Date.now() } });
        break;

      default:
        this.send(ws, { type: 'error', data: { message: `Unknown message type: ${msg.type}` } });
    }
  }

  private handleAuth(ws: SpectatorWs, token?: string): void {
    if (!token) {
      this.send(ws, { type: 'auth:error', data: { message: 'Token required' } });
      return;
    }

    const success = this.authenticate(ws, token);
    if (success) {
      this.send(ws, {
        type: 'auth:success',
        data: { userId: ws.userId, username: ws.username },
      });
    } else {
      this.send(ws, { type: 'auth:error', data: { message: 'Invalid token' } });
    }
  }

  private handleSubscribeMatch(ws: SpectatorWs, matchId?: string): void {
    if (!matchId) {
      this.send(ws, { type: 'error', data: { message: 'matchId required' } });
      return;
    }

    // Verify match exists
    const match = this.orchestrator.getActiveMatch(matchId);
    if (!match) {
      this.send(ws, { type: 'error', data: { message: 'Match not found or not active' } });
      return;
    }

    const roomKey = `match:${matchId}`;
    this.joinRoom(ws, roomKey);

    this.send(ws, {
      type: 'subscribed',
      data: {
        room: roomKey,
        spectatorCount: this.getSpectatorCount(matchId),
      },
    });

    // Notify other spectators of new viewer count
    this.broadcastToRoom(roomKey, {
      type: 'match:spectators',
      data: { matchId, count: this.getSpectatorCount(matchId) },
    });
  }

  private handleUnsubscribeMatch(ws: SpectatorWs, matchId?: string): void {
    if (!matchId) {
      this.send(ws, { type: 'error', data: { message: 'matchId required' } });
      return;
    }

    const roomKey = `match:${matchId}`;
    this.leaveRoom(ws, roomKey);

    this.send(ws, { type: 'unsubscribed', data: { room: roomKey } });

    // Update spectator count for remaining viewers
    this.broadcastToRoom(roomKey, {
      type: 'match:spectators',
      data: { matchId, count: this.getSpectatorCount(matchId) },
    });
  }

  private handleSubscribeLeaderboard(ws: SpectatorWs, period?: string): void {
    const validPeriod = this.validatePeriod(period);
    if (!validPeriod) {
      this.send(ws, {
        type: 'error',
        data: { message: `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}` },
      });
      return;
    }

    const roomKey = `leaderboard:${validPeriod}`;
    this.joinRoom(ws, roomKey);
    this.send(ws, { type: 'subscribed', data: { room: roomKey } });
  }

  private handleUnsubscribeLeaderboard(ws: SpectatorWs, period?: string): void {
    const validPeriod = this.validatePeriod(period);
    if (!validPeriod) return;

    const roomKey = `leaderboard:${validPeriod}`;
    this.leaveRoom(ws, roomKey);
    this.send(ws, { type: 'unsubscribed', data: { room: roomKey } });
  }

  private validatePeriod(period?: string): LeaderboardPeriod | null {
    if (!period) return null;
    return VALID_PERIODS.includes(period as LeaderboardPeriod)
      ? (period as LeaderboardPeriod)
      : null;
  }

  // ---------------------------------------------------------------------------
  // Room management
  // ---------------------------------------------------------------------------

  private joinRoom(ws: SpectatorWs, roomKey: string): void {
    if (!this.rooms.has(roomKey)) {
      this.rooms.set(roomKey, new Set());
    }
    this.rooms.get(roomKey)!.add(ws);
    ws.subscriptions!.add(roomKey);
  }

  private leaveRoom(ws: SpectatorWs, roomKey: string): void {
    const room = this.rooms.get(roomKey);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.rooms.delete(roomKey);
      }
    }
    ws.subscriptions?.delete(roomKey);
  }

  private leaveAllRooms(ws: SpectatorWs): void {
    if (!ws.subscriptions) return;
    for (const roomKey of ws.subscriptions) {
      const room = this.rooms.get(roomKey);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          this.rooms.delete(roomKey);
        }
      }
    }
    ws.subscriptions.clear();
  }

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  private handleDisconnect(ws: SpectatorWs): void {
    // Collect match rooms before leaving so we can update spectator counts
    const matchRooms: string[] = [];
    if (ws.subscriptions) {
      for (const key of ws.subscriptions) {
        if (key.startsWith('match:')) {
          matchRooms.push(key);
        }
      }
    }

    this.leaveAllRooms(ws);

    // Broadcast updated spectator counts
    for (const roomKey of matchRooms) {
      const matchId = roomKey.replace('match:', '');
      this.broadcastToRoom(roomKey, {
        type: 'match:spectators',
        data: { matchId, count: this.getSpectatorCount(matchId) },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Orchestrator event forwarding
  // ---------------------------------------------------------------------------

  private setupOrchestratorEvents(): void {
    // Match ticks — forward to spectators watching the match
    this.orchestrator.on('match:tick', (data) => {
      const roomKey = `match:${data.matchId}`;
      this.broadcastToRoom(roomKey, {
        type: 'match:tick',
        data: {
          matchId: data.matchId,
          elapsed: data.elapsed,
          bot1: data.bot1,
          bot2: data.bot2,
          prices: data.prices,
        },
      });
    });

    // Trade events
    this.orchestrator.on('match:trade', (data) => {
      const roomKey = `match:${data.matchId}`;
      this.broadcastToRoom(roomKey, {
        type: 'match:trade',
        data: {
          matchId: data.matchId,
          botId: data.botId,
          symbol: data.symbol,
          side: data.side,
          action: data.action,
          price: data.price,
          quantity: data.quantity,
          pnl: data.pnl,
          timestamp: data.timestamp,
        },
      });
    });

    // Match created — notify queue watchers about the match found
    this.orchestrator.on('match:created', (data) => {
      // Notify authenticated users in queue room if they have a bot in this match
      this.broadcastToRoom('queue', {
        type: 'match:found',
        data: {
          matchId: data.matchId,
          bot1Id: data.bot1Id,
          bot2Id: data.bot2Id,
        },
      });

      // Push updated queue stats
      const stats = this.orchestrator.getQueueStats();
      this.broadcastToRoom('queue', {
        type: 'queue:update',
        data: {
          totalInQueue: stats.totalInQueue,
          byTier: stats.byTier,
        },
      });
    });

    // Match ended — notify spectators and update leaderboards
    this.orchestrator.on('match:ended', ({ matchId, result }) => {
      const roomKey = `match:${matchId}`;
      this.broadcastToRoom(roomKey, {
        type: 'match:end',
        data: {
          matchId,
          winner: result.winner,
          scores: {
            bot1: result.bot1.score,
            bot2: result.bot2.score,
          },
          eloChanges: {
            bot1: { eloChange: result.bot1.eloChange, newElo: result.bot1.newElo },
            bot2: { eloChange: result.bot2.eloChange, newElo: result.bot2.newElo },
          },
        },
      });

      // Clean up the match room after a short delay so clients receive the final message
      setTimeout(() => {
        this.rooms.delete(roomKey);
      }, 5000);
    });

    // Bot queued/dequeued — update queue watchers
    this.orchestrator.on('bot:queued', () => {
      const stats = this.orchestrator.getQueueStats();
      this.broadcastToRoom('queue', {
        type: 'queue:update',
        data: {
          totalInQueue: stats.totalInQueue,
          byTier: stats.byTier,
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Broadcast helpers
  // ---------------------------------------------------------------------------

  /**
   * Send a message to all clients in a room.
   */
  broadcastToRoom(roomKey: string, msg: object): void {
    const room = this.rooms.get(roomKey);
    if (!room) return;

    const payload = JSON.stringify(msg);
    for (const ws of room) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Send a message to all connected spectators.
   */
  broadcastToAll(msg: object): void {
    const payload = JSON.stringify(msg);
    this.wss.clients.forEach((ws: WebSocket) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  /**
   * Send a message to a specific authenticated user across all their connections.
   */
  broadcastToUser(userId: string, msg: object): void {
    const payload = JSON.stringify(msg);
    this.wss.clients.forEach((ws: WebSocket) => {
      const spectator = ws as SpectatorWs;
      if (spectator.userId === userId && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  /**
   * Send an achievement notification to a specific user.
   */
  sendAchievement(userId: string, achievement: object): void {
    this.broadcastToUser(userId, {
      type: 'achievement:unlocked',
      data: { achievement },
    });
  }

  /**
   * Send a notification to a specific user.
   */
  sendNotification(userId: string, message: string): void {
    this.broadcastToUser(userId, {
      type: 'notification',
      data: { message },
    });
  }

  /**
   * Push a leaderboard update to all subscribers of the given period.
   */
  sendLeaderboardUpdate(period: LeaderboardPeriod, entries: object[]): void {
    this.broadcastToRoom(`leaderboard:${period}`, {
      type: 'leaderboard:update',
      data: { period, entries },
    });
  }

  // ---------------------------------------------------------------------------
  // Public accessors
  // ---------------------------------------------------------------------------

  /**
   * Get the number of spectators watching a specific match.
   */
  getSpectatorCount(matchId: string): number {
    const room = this.rooms.get(`match:${matchId}`);
    return room ? room.size : 0;
  }

  /**
   * Get total connected spectator count.
   */
  getTotalSpectatorCount(): number {
    return this.wss.clients.size;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private send(ws: WebSocket, msg: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.rooms.clear();
    this.wss.close();
  }
}
