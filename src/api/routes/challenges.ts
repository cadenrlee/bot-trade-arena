import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const startChallengeSchema = z.object({
  botId: z.string().min(1),
});

// GET /api/challenges — list active challenges
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const [challenges, total] = await Promise.all([
      prisma.challenge.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          difficulty: true,
          duration: true,
          marketSymbols: true,
          benchmark: true,
          isDaily: true,
          createdAt: true,
          _count: { select: { runs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.challenge.count({ where: { isActive: true } }),
    ]);

    const data = challenges.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      type: c.type,
      difficulty: c.difficulty,
      duration: c.duration,
      marketSymbols: JSON.parse(c.marketSymbols),
      benchmark: c.benchmark,
      isDaily: c.isDaily,
      totalRuns: c._count.runs,
      createdAt: c.createdAt,
    }));

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('List challenges error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/challenges/daily — today's daily challenge
router.get('/daily', async (_req: Request, res: Response) => {
  try {
    const challenge = await prisma.challenge.findFirst({
      where: { isActive: true, isDaily: true },
      include: { _count: { select: { runs: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      res.status(404).json({ error: 'No daily challenge available' });
      return;
    }

    res.json({
      id: challenge.id,
      name: challenge.name,
      description: challenge.description,
      type: challenge.type,
      difficulty: challenge.difficulty,
      duration: challenge.duration,
      marketSymbols: JSON.parse(challenge.marketSymbols),
      benchmark: challenge.benchmark,
      totalRuns: challenge._count.runs,
      createdAt: challenge.createdAt,
    });
  } catch (err) {
    console.error('Get daily challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/challenges/my-runs — my challenge history (authed)
router.get('/my-runs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const [runs, total] = await Promise.all([
      prisma.challengeRun.findMany({
        where: { userId: req.user!.userId },
        include: {
          challenge: { select: { id: true, name: true, type: true, difficulty: true } },
          bot: { select: { id: true, name: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.challengeRun.count({ where: { userId: req.user!.userId } }),
    ]);

    res.json({
      data: runs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('My challenge runs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/challenges/:id — challenge details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: { _count: { select: { runs: true } } },
    });

    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    res.json({
      id: challenge.id,
      name: challenge.name,
      description: challenge.description,
      type: challenge.type,
      difficulty: challenge.difficulty,
      duration: challenge.duration,
      marketSymbols: JSON.parse(challenge.marketSymbols),
      benchmark: challenge.benchmark,
      isActive: challenge.isActive,
      isDaily: challenge.isDaily,
      totalRuns: challenge._count.runs,
      createdAt: challenge.createdAt,
    });
  } catch (err) {
    console.error('Get challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/challenges/:id/start — start a challenge run (authed)
router.post('/:id/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    const challengeId = req.params.id as string;
    const { botId } = startChallengeSchema.parse(req.body);

    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    if (!challenge.isActive) {
      res.status(400).json({ error: 'Challenge is no longer active' });
      return;
    }

    // Verify bot ownership
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot || bot.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    // Check for an existing in-progress run
    const activeRun = await prisma.challengeRun.findFirst({
      where: { challengeId, userId: req.user!.userId, completed: false },
    });
    if (activeRun) {
      res.status(409).json({ error: 'You already have an active run for this challenge', runId: activeRun.id });
      return;
    }

    const run = await prisma.challengeRun.create({
      data: {
        challengeId,
        botId,
        userId: req.user!.userId,
      },
    });

    res.status(201).json({
      runId: run.id,
      challengeId: run.challengeId,
      botId: run.botId,
      startedAt: run.startedAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Start challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/challenges/:id/leaderboard — challenge leaderboard
router.get('/:id/leaderboard', async (req: Request, res: Response) => {
  try {
    const challengeId = req.params.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    const [runs, total] = await Promise.all([
      prisma.challengeRun.findMany({
        where: { challengeId, completed: true, passed: true },
        include: {
          bot: { select: { id: true, name: true } },
        },
        orderBy: { score: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.challengeRun.count({ where: { challengeId, completed: true, passed: true } }),
    ]);

    const data = runs.map((run, idx) => ({
      rank: (page - 1) * limit + idx + 1,
      userId: run.userId,
      bot: run.bot,
      score: run.score,
      pnl: run.pnl,
      trades: run.trades,
      endedAt: run.endedAt,
    }));

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Challenge leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
