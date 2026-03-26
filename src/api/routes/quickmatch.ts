/**
 * Bot Trade Arena — Quick Match (Real Multiplayer)
 *
 * Lightweight matchmaking for Quick Battle mode.
 * Players join an in-memory queue. If another player is searching within 8 seconds
 * and within 300 ELO, they're matched and both receive identical market tick data.
 * The battle itself runs client-side — the server only handles matchmaking and
 * result comparison.
 *
 * Routes:
 *   POST /api/quickmatch/search   — Join the matchmaking queue
 *   GET  /api/quickmatch/status/:queueId — Poll for match status
 *   POST /api/quickmatch/result   — Submit battle result
 *   GET  /api/quickmatch/history  — Last 20 match results
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../lib/prisma';

const router = Router();

// ============================================================
// TYPES
// ============================================================

interface QueueEntry {
  queueId: string;
  strategy: string;
  aggression: number;
  riskTolerance: number;
  elo: number;
  ip: string;
  userId?: string;
  username?: string;
  joinedAt: number;
  status: 'waiting' | 'matched' | 'timeout';
  opponentQueueId?: string;
  matchData?: { ticks: MarketTick[] };
  opponent?: { name: string; elo: number; queueId: string };
}

interface MarketTick {
  tick: number;
  timestamp: number;
  symbol: string;
  price: number;
  volume: number;
  high: number;
  low: number;
}

interface MatchResult {
  id: string;
  queueId1: string;
  queueId2: string;
  player1: { name: string; elo: number; pnl?: number; trades?: number; wins?: number };
  player2: { name: string; elo: number; pnl?: number; trades?: number; wins?: number };
  winnerId?: string;
  completedAt: number;
  tickCount: number;
}

// ============================================================
// IN-MEMORY STATE
// ============================================================

const queue: Map<string, QueueEntry> = new Map();
const matchResults: MatchResult[] = []; // last 100, ring buffer style

const QUEUE_TIMEOUT_MS = 8000;    // 8 seconds before AI fallback
const ELO_RANGE = 300;            // Match within +/- 300 ELO
const TICK_COUNT = 300;           // Shared market data ticks
const MAX_RESULTS = 100;          // Keep last 100 results in memory
const CLEANUP_INTERVAL_MS = 5000; // Purge stale entries every 5s

// ============================================================
// MARKET DATA GENERATOR
// ============================================================

/**
 * Generates deterministic market tick data using geometric Brownian motion.
 * Both matched players receive identical ticks so battles are fair.
 */
function generateMarketTicks(count: number, seed?: string): MarketTick[] {
  const ticks: MarketTick[] = [];
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  const baseConfig: Record<string, { price: number; volatility: number; drift: number }> = {
    BTCUSDT: { price: 67500, volatility: 0.0004, drift: 0.000002 },
    ETHUSDT: { price: 3200, volatility: 0.0005, drift: 0.000003 },
    SOLUSDT: { price: 145, volatility: 0.0008, drift: 0.000001 },
  };

  // Use seed for deterministic randomness (simple LCG)
  let rngState = seed
    ? seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 2654435761
    : Date.now();

  function nextRandom(): number {
    rngState = (rngState * 1664525 + 1013904223) & 0xffffffff;
    return (rngState >>> 0) / 0xffffffff;
  }

  // Box-Muller transform for normal distribution
  function nextGaussian(): number {
    const u1 = nextRandom() || 0.0001;
    const u2 = nextRandom();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  const prices: Record<string, number> = {};
  for (const sym of symbols) {
    prices[sym] = baseConfig[sym].price;
  }

  const baseTimestamp = Date.now();

  for (let i = 0; i < count; i++) {
    for (const sym of symbols) {
      const conf = baseConfig[sym];
      const z = nextGaussian();
      const ret = conf.drift + conf.volatility * z;
      prices[sym] = prices[sym] * (1 + ret);

      const variation = nextRandom() * conf.volatility * prices[sym];
      ticks.push({
        tick: i,
        timestamp: baseTimestamp + i * 1000,
        symbol: sym,
        price: Math.round(prices[sym] * 100) / 100,
        volume: Math.round((500 + nextRandom() * 2000) * 100) / 100,
        high: Math.round((prices[sym] + variation) * 100) / 100,
        low: Math.round((prices[sym] - variation) * 100) / 100,
      });
    }
  }

  return ticks;
}

// ============================================================
// MATCHMAKING LOGIC
// ============================================================

/**
 * Try to match a newly queued player with someone already waiting.
 * Returns true if a match was made.
 */
function tryMatch(entry: QueueEntry): boolean {
  for (const [id, candidate] of queue) {
    if (id === entry.queueId) continue;
    if (candidate.status !== 'waiting') continue;

    // ELO range check
    const gap = Math.abs(entry.elo - candidate.elo);
    if (gap > ELO_RANGE) continue;

    // Don't match same user against themselves
    if (entry.userId && entry.userId === candidate.userId) continue;
    if (!entry.userId && !candidate.userId && entry.ip === candidate.ip) continue;

    // Match found — generate shared market data
    const matchSeed = `${entry.queueId}-${candidate.queueId}-${Date.now()}`;
    const ticks = generateMarketTicks(TICK_COUNT, matchSeed);

    // Update both entries
    const entryOpponent = {
      name: candidate.username || `Player_${candidate.queueId.slice(0, 6)}`,
      elo: candidate.elo,
      queueId: candidate.queueId,
    };
    const candidateOpponent = {
      name: entry.username || `Player_${entry.queueId.slice(0, 6)}`,
      elo: entry.elo,
      queueId: entry.queueId,
    };

    entry.status = 'matched';
    entry.opponent = entryOpponent;
    entry.opponentQueueId = candidate.queueId;
    entry.matchData = { ticks };

    candidate.status = 'matched';
    candidate.opponent = candidateOpponent;
    candidate.opponentQueueId = entry.queueId;
    candidate.matchData = { ticks };

    // Create a pending match result entry
    const result: MatchResult = {
      id: crypto.randomUUID(),
      queueId1: entry.queueId,
      queueId2: candidate.queueId,
      player1: { name: candidateOpponent.name, elo: entry.elo },
      player2: { name: entryOpponent.name, elo: candidate.elo },
      completedAt: 0,
      tickCount: TICK_COUNT,
    };
    matchResults.push(result);
    if (matchResults.length > MAX_RESULTS) {
      matchResults.shift();
    }

    return true;
  }

  return false;
}

// ============================================================
// CLEANUP: Expire stale queue entries
// ============================================================

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of queue) {
    // Timeout waiting entries after QUEUE_TIMEOUT_MS
    if (entry.status === 'waiting' && now - entry.joinedAt > QUEUE_TIMEOUT_MS) {
      entry.status = 'timeout';
    }
    // Remove entries that have been resolved for more than 60 seconds
    if (entry.status !== 'waiting' && now - entry.joinedAt > 60000) {
      queue.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS);

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /api/quickmatch/search
 * Join the matchmaking queue for Quick Battle.
 *
 * Body: { strategy, aggression, riskTolerance, elo }
 * Returns: { queueId }
 */
router.post('/search', (req: Request, res: Response) => {
  try {
    const { strategy, aggression, riskTolerance, elo } = req.body;

    if (typeof elo !== 'number' || elo < 0 || elo > 5000) {
      res.status(400).json({ error: 'Invalid elo value (must be 0-5000)' });
      return;
    }
    if (!strategy || typeof strategy !== 'string') {
      res.status(400).json({ error: 'strategy is required' });
      return;
    }
    if (typeof aggression !== 'number' || typeof riskTolerance !== 'number') {
      res.status(400).json({ error: 'aggression and riskTolerance must be numbers' });
      return;
    }

    const queueId = crypto.randomUUID();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || 'unknown';

    // Extract user info from auth header if present (optional auth)
    let userId: string | undefined;
    let username: string | undefined;
    try {
      const header = req.headers.authorization;
      if (header?.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const { config } = require('../../lib/config');
        const payload = jwt.verify(header.slice(7), config.jwt.secret) as { userId: string; username: string };
        userId = payload.userId;
        username = payload.username;
      }
    } catch {
      // Not authenticated — that's fine, play anonymously
    }

    const entry: QueueEntry = {
      queueId,
      strategy,
      aggression,
      riskTolerance,
      elo,
      ip,
      userId,
      username,
      joinedAt: Date.now(),
      status: 'waiting',
    };

    queue.set(queueId, entry);

    // Immediately attempt to find a match
    tryMatch(entry);

    res.json({ queueId });
  } catch (err) {
    console.error('[QuickMatch] Search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/quickmatch/status/:queueId
 * Poll for matchmaking status.
 *
 * Returns: { status: 'waiting' | 'matched' | 'timeout', opponent?, matchData? }
 */
router.get('/status/:queueId', (req: Request, res: Response) => {
  try {
    const queueId = req.params.queueId as string;
    const entry = queue.get(queueId);

    if (!entry) {
      res.status(404).json({ error: 'Queue entry not found or expired' });
      return;
    }

    // If still waiting, re-attempt matching (opponent may have joined since last check)
    if (entry.status === 'waiting') {
      // Check timeout
      if (Date.now() - entry.joinedAt > QUEUE_TIMEOUT_MS) {
        entry.status = 'timeout';
      } else {
        tryMatch(entry);
      }
    }

    const response: any = {
      status: entry.status,
      waitTime: Date.now() - entry.joinedAt,
    };

    if (entry.status === 'matched') {
      response.opponent = entry.opponent;
      response.matchData = entry.matchData;
    }

    res.json(response);
  } catch (err) {
    console.error('[QuickMatch] Status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/quickmatch/result
 * Submit battle result after the client-side simulation completes.
 *
 * Body: { queueId, pnl, trades, wins }
 */
router.post('/result', async (req: Request, res: Response) => {
  try {
    const { queueId, pnl, trades, wins } = req.body;

    if (!queueId || typeof pnl !== 'number' || typeof trades !== 'number' || typeof wins !== 'number') {
      res.status(400).json({ error: 'queueId, pnl, trades, and wins are required (numbers)' });
      return;
    }

    const entry = queue.get(queueId);
    if (!entry) {
      res.status(404).json({ error: 'Queue entry not found or expired' });
      return;
    }

    if (entry.status !== 'matched') {
      res.status(400).json({ error: 'Cannot submit result for a non-matched entry' });
      return;
    }

    // Find the match result record
    const matchResult = matchResults.find(
      (r) => r.queueId1 === queueId || r.queueId2 === queueId
    );

    if (!matchResult) {
      res.status(404).json({ error: 'Match result record not found' });
      return;
    }

    // Update the appropriate player's result
    const isPlayer1 = matchResult.queueId1 === queueId;
    const player = isPlayer1 ? matchResult.player1 : matchResult.player2;
    player.pnl = pnl;
    player.trades = trades;
    player.wins = wins;

    // Check if both players have submitted
    const bothSubmitted =
      matchResult.player1.pnl !== undefined &&
      matchResult.player2.pnl !== undefined;

    let winner: string | undefined;

    if (bothSubmitted) {
      matchResult.completedAt = Date.now();

      // Determine winner by PnL
      if (matchResult.player1.pnl! > matchResult.player2.pnl!) {
        matchResult.winnerId = matchResult.queueId1;
        winner = matchResult.player1.name;
      } else if (matchResult.player2.pnl! > matchResult.player1.pnl!) {
        matchResult.winnerId = matchResult.queueId2;
        winner = matchResult.player2.name;
      }
      // Otherwise it's a draw — winnerId stays undefined

      // Persist to database if user is authenticated
      if (entry.userId) {
        try {
          await prisma.quickMatchHistory.create({
            data: {
              odId: matchResult.id,
              odUserId: entry.userId,
              playerName: isPlayer1 ? matchResult.player1.name : matchResult.player2.name,
              playerElo: isPlayer1 ? matchResult.player1.elo : matchResult.player2.elo,
              opponentName: isPlayer1 ? matchResult.player2.name : matchResult.player1.name,
              opponentElo: isPlayer1 ? matchResult.player2.elo : matchResult.player1.elo,
              playerPnl: pnl,
              playerTrades: trades,
              playerWins: wins,
              opponentPnl: isPlayer1 ? matchResult.player2.pnl! : matchResult.player1.pnl!,
              opponentTrades: isPlayer1 ? matchResult.player2.trades! : matchResult.player1.trades!,
              opponentWins: isPlayer1 ? matchResult.player2.wins! : matchResult.player1.wins!,
              isWinner: matchResult.winnerId === queueId,
              isDraw: matchResult.winnerId === undefined,
              tickCount: matchResult.tickCount,
            },
          });
        } catch (dbErr) {
          // DB save is best-effort — don't fail the request
          console.error('[QuickMatch] DB save error:', dbErr);
        }
      }
    }

    res.json({
      recorded: true,
      bothSubmitted,
      winner: bothSubmitted ? (winner || 'draw') : undefined,
      matchResult: bothSubmitted ? {
        player1: matchResult.player1,
        player2: matchResult.player2,
        winner: winner || 'draw',
      } : undefined,
    });
  } catch (err) {
    console.error('[QuickMatch] Result error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/quickmatch/history
 * Get last 20 match results for the current user (by auth or IP).
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    // Try to get authenticated user
    let userId: string | undefined;
    try {
      const header = req.headers.authorization;
      if (header?.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const { config } = require('../../lib/config');
        const payload = jwt.verify(header.slice(7), config.jwt.secret) as { userId: string; username: string };
        userId = payload.userId;
      }
    } catch {
      // Not authenticated
    }

    // If authenticated, try DB first
    if (userId) {
      try {
        const dbHistory = await prisma.quickMatchHistory.findMany({
          where: { odUserId: userId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });

        if (dbHistory.length > 0) {
          res.json(dbHistory);
          return;
        }
      } catch {
        // DB query failed — fall through to in-memory
      }
    }

    // Fall back to in-memory results (filter by IP for non-logged-in users)
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || 'unknown';

    // Find queue entries for this IP/user to get their queueIds
    const myQueueIds = new Set<string>();
    for (const [id, entry] of queue) {
      if (userId && entry.userId === userId) {
        myQueueIds.add(id);
      } else if (!userId && entry.ip === ip) {
        myQueueIds.add(id);
      }
    }

    // Filter match results to include this player
    const myResults = matchResults
      .filter((r) => myQueueIds.has(r.queueId1) || myQueueIds.has(r.queueId2))
      .filter((r) => r.completedAt > 0)
      .slice(-20)
      .reverse()
      .map((r) => {
        const isP1 = myQueueIds.has(r.queueId1);
        return {
          id: r.id,
          playerName: isP1 ? r.player1.name : r.player2.name,
          playerElo: isP1 ? r.player1.elo : r.player2.elo,
          opponentName: isP1 ? r.player2.name : r.player1.name,
          opponentElo: isP1 ? r.player2.elo : r.player1.elo,
          playerPnl: isP1 ? r.player1.pnl : r.player2.pnl,
          opponentPnl: isP1 ? r.player2.pnl : r.player1.pnl,
          isWinner: r.winnerId ? (isP1 ? r.winnerId === r.queueId1 : r.winnerId === r.queueId2) : false,
          isDraw: !r.winnerId,
          completedAt: new Date(r.completedAt).toISOString(),
        };
      });

    res.json(myResults);
  } catch (err) {
    console.error('[QuickMatch] History error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
