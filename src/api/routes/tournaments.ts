import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  botId: z.string().min(1),
});

// GET /api/tournaments — list tournaments
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const status = req.query.status as string | undefined;

    const where: Record<string, any> = {};
    if (status) where.status = status.toUpperCase();

    const [tournaments, total] = await Promise.all([
      prisma.tournament.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          format: true,
          tier: true,
          maxEntrants: true,
          entryFee: true,
          prizePool: true,
          registrationOpen: true,
          registrationClose: true,
          startDate: true,
          endDate: true,
          status: true,
          _count: { select: { entries: true } },
        },
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tournament.count({ where }),
    ]);

    const data = tournaments.map((t) => ({
      ...t,
      entrantCount: t._count.entries,
      _count: undefined,
    }));

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('List tournaments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tournaments/:id — tournament details + bracket
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        entries: {
          select: {
            id: true,
            userId: true,
            botId: true,
            seed: true,
            placement: true,
            wins: true,
            losses: true,
            prizePayout: true,
          },
          orderBy: { seed: 'asc' },
        },
        season: { select: { id: true, name: true, number: true } },
        _count: { select: { matches: true } },
      },
    });

    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }

    res.json({
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      format: tournament.format,
      tier: tournament.tier,
      maxEntrants: tournament.maxEntrants,
      entryFee: tournament.entryFee,
      prizePool: tournament.prizePool,
      registrationOpen: tournament.registrationOpen,
      registrationClose: tournament.registrationClose,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      status: tournament.status,
      bracket: tournament.bracketData ? JSON.parse(tournament.bracketData) : null,
      season: tournament.season,
      entries: tournament.entries,
      matchCount: tournament._count.matches,
    });
  } catch (err) {
    console.error('Get tournament error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tournaments/:id/register — register for tournament (authed)
router.post('/:id/register', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tournamentId = req.params.id as string;
    const { botId } = registerSchema.parse(req.body);

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { _count: { select: { entries: true } } },
    });
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    if (tournament.status !== 'UPCOMING') {
      res.status(400).json({ error: 'Registration is not open for this tournament' });
      return;
    }

    const now = new Date();
    if (now < tournament.registrationOpen || now > tournament.registrationClose) {
      res.status(400).json({ error: 'Registration window is closed' });
      return;
    }
    if (tournament._count.entries >= tournament.maxEntrants) {
      res.status(400).json({ error: 'Tournament is full' });
      return;
    }

    // Verify bot ownership
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot || bot.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    // Check if already registered
    const existing = await prisma.tournamentEntry.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: req.user!.userId } },
    });
    if (existing) {
      res.status(409).json({ error: 'Already registered for this tournament' });
      return;
    }

    const entry = await prisma.tournamentEntry.create({
      data: { tournamentId, userId: req.user!.userId, botId },
    });

    res.status(201).json(entry);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Register tournament error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tournaments/:id/register — withdraw from tournament (authed)
router.delete('/:id/register', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tournamentId = req.params.id as string;

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    if (tournament.status !== 'UPCOMING') {
      res.status(400).json({ error: 'Cannot withdraw after tournament has started' });
      return;
    }

    const entry = await prisma.tournamentEntry.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: req.user!.userId } },
    });
    if (!entry) {
      res.status(404).json({ error: 'Not registered for this tournament' });
      return;
    }

    await prisma.tournamentEntry.delete({ where: { id: entry.id } });

    res.json({ success: true });
  } catch (err) {
    console.error('Withdraw tournament error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tournaments/:id/matches — tournament matches
router.get('/:id/matches', async (req: Request, res: Response) => {
  try {
    const tournamentId = req.params.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where: { tournamentId },
        include: {
          bot1: { select: { id: true, name: true, elo: true } },
          bot2: { select: { id: true, name: true, elo: true } },
          player1: { select: { id: true, username: true } },
          player2: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.match.count({ where: { tournamentId } }),
    ]);

    res.json({
      data: matches,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Tournament matches error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tournaments/:id/standings — current standings
router.get('/:id/standings', async (req: Request, res: Response) => {
  try {
    const tournamentId = req.params.id as string;

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }

    const entries = await prisma.tournamentEntry.findMany({
      where: { tournamentId },
      orderBy: [{ wins: 'desc' }, { losses: 'asc' }],
    });

    const standings = entries.map((entry, idx) => ({
      rank: entry.placement ?? idx + 1,
      userId: entry.userId,
      botId: entry.botId,
      wins: entry.wins,
      losses: entry.losses,
      prizePayout: entry.prizePayout,
    }));

    res.json(standings);
  } catch (err) {
    console.error('Tournament standings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
