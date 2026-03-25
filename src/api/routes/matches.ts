import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { houseBotService } from '../../services/houseBots';
import { alpacaStatsService } from '../../services/alpacaStats';

const router = Router();

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

    // Check if user wants stock mode (requires market hours)
    let matchMode = mode || 'crypto'; // 'crypto' or 'stocks'
    let marketStatus = null;

    if (matchMode === 'stocks') {
      const apiKey = process.env.ALPACA_API_KEY;
      const apiSecret = process.env.ALPACA_API_SECRET;
      if (apiKey && apiSecret) {
        marketStatus = await alpacaStatsService.isMarketOpen(apiKey, apiSecret);
        if (!marketStatus.isOpen) {
          res.status(400).json({
            error: 'Stock market is closed',
            marketStatus,
            message: `Market is closed. Next open: ${marketStatus.nextOpen}. Use crypto mode for 24/7 matches.`,
          });
          return;
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
      marketStatus,
      message: `Match started! (${matchMode} mode)`,
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

// GET /api/matches — list my match history (authenticated)
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

export default router;
