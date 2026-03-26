import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { houseBotService } from '../../services/houseBots';
import { alpacaStatsService } from '../../services/alpacaStats';

const router = Router();

// GET /api/matches — list my match history (authenticated)
// MUST be before /:matchId to avoid being shadowed
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { player1Id: req.user!.userId },
          { player2Id: req.user!.userId },
        ],
        status: 'COMPLETED',
      },
      include: {
        bot1: { select: { id: true, name: true } },
        bot2: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    res.json(matches);
  } catch (err) {
    console.error('List matches error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/matches/live — list currently live matches (public)
router.get('/live', async (_req: Request, res: Response) => {
  try {
    const matches = await prisma.match.findMany({
      where: { status: 'RUNNING' },
      include: {
        bot1: { select: { id: true, name: true, elo: true } },
        bot2: { select: { id: true, name: true, elo: true } },
        player1: { select: { id: true, username: true } },
        player2: { select: { id: true, username: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
    res.json(matches);
  } catch (err) {
    console.error('List live matches error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/matches/vs-ai — start a match against a house bot
router.post('/vs-ai', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { botId, difficulty, mode } = req.body;
    if (!botId) {
      res.status(400).json({ error: 'botId is required' });
      return;
    }

    // Verify bot belongs to user
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot || bot.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    // Access orchestrator via app locals
    const orchestrator = req.app.locals.orchestrator;
    if (!orchestrator) {
      res.status(500).json({ error: 'Match system not ready' });
      return;
    }

    // Determine match mode — always allow matches, adapt data source
    let matchMode = mode || 'crypto';
    let marketStatus = null;
    let dataSource = 'live';

    if (matchMode === 'stocks') {
      const apiKey = process.env.ALPACA_API_KEY;
      const apiSecret = process.env.ALPACA_API_SECRET;
      if (apiKey && apiSecret) {
        marketStatus = await alpacaStatsService.isMarketOpen(apiKey, apiSecret);
        if (!marketStatus.isOpen) {
          // Market closed — use simulated data instead of blocking
          dataSource = 'replay';
          matchMode = 'crypto'; // Fall back to crypto/simulated
        }
      }
    }

    const result = await orchestrator.startVsAI(botId, difficulty || undefined, matchMode);
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      matchId: result.matchId,
      mode: matchMode,
      dataSource,
      marketStatus,
      message: dataSource === 'replay'
        ? 'Match started! Using simulated market data (stock market is closed).'
        : `Match started! (${matchMode} mode)`,
    });
  } catch (err) {
    console.error('Start vs AI error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/matches/house-bots — list available AI opponents
router.get('/house-bots', (_req: Request, res: Response) => {
  res.json(houseBotService.getAvailableBots());
});

// GET /api/matches/:matchId/live — real-time match state for polling
router.get('/:matchId/live', async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const orchestrator = req.app.locals.orchestrator;
    if (!orchestrator) {
      res.status(500).json({ error: 'Match system not ready' });
      return;
    }

    const engine = orchestrator.getActiveMatch(matchId);
    if (engine) {
      // Match is running — return real live state from engine
      res.json({ live: true, ...engine.getLiveState() });
    } else {
      // Match not active — return DB state
      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match) { res.status(404).json({ error: 'Match not found' }); return; }
      res.json({
        status: match.status,
        elapsed: match.duration || 0,
        remaining: 0,
        duration: match.duration,
        live: false,
        bot1Pnl: match.bot1Pnl,
        bot2Pnl: match.bot2Pnl,
        bot1Score: match.bot1Score,
        bot2Score: match.bot2Score,
        bot1Trades: match.bot1Trades,
        bot2Trades: match.bot2Trades,
        winnerId: match.winnerId,
      });
    }
  } catch (err) {
    console.error('Live match error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/matches/:matchId
router.get('/:matchId', async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        bot1: { select: { id: true, name: true, elo: true } },
        bot2: { select: { id: true, name: true, elo: true } },
        player1: { select: { id: true, username: true } },
        player2: { select: { id: true, username: true } },
      },
    });
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }
    res.json(match);
  } catch (err) {
    console.error('Get match error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/matches/:matchId/replay
router.get('/:matchId/replay', async (req: Request, res: Response) => {
  try {
    const replayMatchId = req.params.matchId as string;
    const snapshots = await prisma.matchSnapshot.findMany({
      where: { matchId: replayMatchId },
      orderBy: { elapsed: 'asc' },
    });
    res.json(snapshots);
  } catch (err) {
    console.error('Get replay error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
