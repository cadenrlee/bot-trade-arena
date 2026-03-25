import { Router, Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/seasons — list all seasons
router.get('/', async (_req: Request, res: Response) => {
  try {
    const seasons = await prisma.season.findMany({
      orderBy: { number: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        number: true,
        startDate: true,
        endDate: true,
        isActive: true,
        theme: true,
        _count: { select: { entries: true, matches: true, tournaments: true } },
      },
    });

    res.json(seasons.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      number: s.number,
      startDate: s.startDate,
      endDate: s.endDate,
      isActive: s.isActive,
      theme: s.theme,
      entryCount: s._count.entries,
      matchCount: s._count.matches,
      tournamentCount: s._count.tournaments,
    })));
  } catch (err) {
    console.error('List seasons error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/seasons/current — current active season
router.get('/current', async (_req: Request, res: Response) => {
  try {
    const season = await prisma.season.findFirst({
      where: { isActive: true },
      include: {
        _count: { select: { entries: true, matches: true, tournaments: true } },
      },
    });

    if (!season) {
      res.status(404).json({ error: 'No active season' });
      return;
    }

    res.json({
      id: season.id,
      name: season.name,
      description: season.description,
      number: season.number,
      startDate: season.startDate,
      endDate: season.endDate,
      isActive: season.isActive,
      allowedSymbols: JSON.parse(season.allowedSymbols),
      theme: season.theme,
      entryCount: season._count.entries,
      matchCount: season._count.matches,
      tournamentCount: season._count.tournaments,
    });
  } catch (err) {
    console.error('Get current season error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/seasons/:id — season details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const season = await prisma.season.findUnique({
      where: { id },
      include: {
        tournaments: {
          select: { id: true, name: true, format: true, status: true, startDate: true },
          orderBy: { startDate: 'asc' },
        },
        _count: { select: { entries: true, matches: true } },
      },
    });

    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    res.json({
      id: season.id,
      name: season.name,
      description: season.description,
      number: season.number,
      startDate: season.startDate,
      endDate: season.endDate,
      isActive: season.isActive,
      allowedSymbols: JSON.parse(season.allowedSymbols),
      theme: season.theme,
      tournaments: season.tournaments,
      entryCount: season._count.entries,
      matchCount: season._count.matches,
    });
  } catch (err) {
    console.error('Get season error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/seasons/:id/claim — claim season rewards (authed)
router.post('/:id/claim', authMiddleware, async (req: Request, res: Response) => {
  try {
    const seasonId = req.params.id as string;

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }
    if (season.isActive) {
      res.status(400).json({ error: 'Season is still active, cannot claim rewards yet' });
      return;
    }

    const entry = await prisma.seasonEntry.findUnique({
      where: { userId_seasonId: { userId: req.user!.userId, seasonId } },
    });
    if (!entry) {
      res.status(404).json({ error: 'You did not participate in this season' });
      return;
    }
    if (entry.rewardsClaimed) {
      res.status(409).json({ error: 'Rewards already claimed' });
      return;
    }

    const updated = await prisma.seasonEntry.update({
      where: { id: entry.id },
      data: { rewardsClaimed: true },
    });

    res.json({
      success: true,
      season: { id: season.id, name: season.name, number: season.number },
      entry: {
        elo: updated.elo,
        tier: updated.tier,
        peakElo: updated.peakElo,
        peakTier: updated.peakTier,
        wins: updated.wins,
        losses: updated.losses,
        draws: updated.draws,
      },
    });
  } catch (err) {
    console.error('Claim rewards error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
