import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Admin check middleware — for now, just verify user exists
// TODO: Add admin flag to User model
async function adminCheck(req: Request, res: Response, next: Function) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) {
    res.status(403).json({ error: 'User not found' });
    return;
  }
  next();
}

const createSeasonSchema = z.object({
  name: z.string().min(1).max(100),
  number: z.number().int().positive(),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  allowedSymbols: z.array(z.string()).default(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']),
});

const createTournamentSchema = z.object({
  name: z.string().min(1).max(100),
  format: z.enum(['SINGLE_ELIM', 'DOUBLE_ELIM', 'SWISS', 'ROUND_ROBIN']),
  maxEntrants: z.number().int().positive().default(32),
  registrationOpen: z.string().transform((s) => new Date(s)),
  registrationClose: z.string().transform((s) => new Date(s)),
  startDate: z.string().transform((s) => new Date(s)),
});

// GET /api/admin/stats — Dashboard stats
router.get('/stats', authMiddleware, adminCheck, async (_req: Request, res: Response) => {
  try {
    const [totalUsers, totalBots, totalMatches, activeSubscriptions] = await Promise.all([
      prisma.user.count(),
      prisma.bot.count(),
      prisma.match.count(),
      prisma.user.count({ where: { plan: { not: 'FREE' } } }),
    ]);

    res.json({
      totalUsers,
      totalBots,
      totalMatches,
      activeSubscriptions,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/seasons — Create a season
router.post('/seasons', authMiddleware, adminCheck, async (req: Request, res: Response) => {
  try {
    const data = createSeasonSchema.parse(req.body);

    const season = await prisma.season.create({
      data: {
        name: data.name,
        number: data.number,
        startDate: data.startDate,
        endDate: data.endDate,
        allowedSymbols: JSON.stringify(data.allowedSymbols),
        isActive: false,
      },
    });

    res.status(201).json(season);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Create season error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/tournaments — Create a tournament
router.post('/tournaments', authMiddleware, adminCheck, async (req: Request, res: Response) => {
  try {
    const data = createTournamentSchema.parse(req.body);

    const tournament = await prisma.tournament.create({
      data: {
        name: data.name,
        format: data.format,
        maxEntrants: data.maxEntrants,
        registrationOpen: data.registrationOpen,
        registrationClose: data.registrationClose,
        startDate: data.startDate,
        status: 'UPCOMING',
      },
    });

    res.status(201).json(tournament);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Create tournament error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/run-decay — Manually trigger ELO decay
router.post('/run-decay', authMiddleware, adminCheck, async (_req: Request, res: Response) => {
  try {
    const decayRecords = await prisma.eloDecay.findMany({
      where: { isDecaying: true },
    });

    let decayed = 0;
    for (const record of decayRecords) {
      const decayAmount = 5; // 5 ELO per decay cycle
      await prisma.user.update({
        where: { id: record.userId },
        data: { elo: { decrement: decayAmount } },
      });
      await prisma.eloDecay.update({
        where: { id: record.id },
        data: { totalDecayed: { increment: decayAmount } },
      });
      decayed++;
    }

    res.json({ success: true, usersDecayed: decayed });
  } catch (err) {
    console.error('Run decay error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/send-streak-warnings — Send streak warnings
router.post('/send-streak-warnings', authMiddleware, adminCheck, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find users whose streak is about to break (no activity in 20+ hours)
    const atRiskStreaks = await prisma.userStreak.findMany({
      where: {
        currentStreak: { gt: 0 },
        lastActivityAt: { lt: oneDayAgo },
      },
    });

    let warned = 0;
    for (const streak of atRiskStreaks) {
      await prisma.notification.create({
        data: {
          userId: streak.userId,
          type: 'STREAK_WARNING',
          title: 'Streak at risk!',
          message: `Your ${streak.currentStreak}-day streak is about to break! Play a match to keep it alive.`,
        },
      });
      warned++;
    }

    res.json({ success: true, usersWarned: warned });
  } catch (err) {
    console.error('Send streak warnings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/grant-freezes — Grant weekly freezes to PRO users
router.post('/grant-freezes', authMiddleware, adminCheck, async (_req: Request, res: Response) => {
  try {
    const proUsers = await prisma.user.findMany({
      where: { plan: 'PRO' },
      select: { id: true },
    });

    let granted = 0;
    for (const user of proUsers) {
      await prisma.userStreak.upsert({
        where: { userId: user.id },
        update: { freezesAvailable: { increment: 1 } },
        create: { userId: user.id, freezesAvailable: 1 },
      });
      granted++;
    }

    res.json({ success: true, usersGranted: granted });
  } catch (err) {
    console.error('Grant freezes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/update-leaderboards — Refresh leaderboard entries
router.post('/update-leaderboards', authMiddleware, adminCheck, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { totalMatches: { gt: 0 } },
      orderBy: { elo: 'desc' },
      select: {
        id: true,
        elo: true,
        tier: true,
        totalWins: true,
        totalLosses: true,
      },
    });

    const now = new Date();
    const periodKey = `${now.getFullYear()}-W${Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)}`;

    let updated = 0;
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      await prisma.leaderboardEntry.upsert({
        where: {
          userId_period_periodKey: {
            userId: u.id,
            period: 'WEEKLY',
            periodKey,
          },
        },
        update: {
          rank: i + 1,
          elo: u.elo,
          tier: u.tier,
          wins: u.totalWins,
          losses: u.totalLosses,
          avgScore: 0,
          totalPnl: 0,
          updatedAt: now,
        },
        create: {
          userId: u.id,
          period: 'WEEKLY',
          periodKey,
          rank: i + 1,
          elo: u.elo,
          tier: u.tier,
          wins: u.totalWins,
          losses: u.totalLosses,
          avgScore: 0,
          totalPnl: 0,
        },
      });
      updated++;
    }

    res.json({ success: true, entriesUpdated: updated });
  } catch (err) {
    console.error('Update leaderboards error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/clear-test-data — Clear test matches and data
router.post('/clear-test-data', authMiddleware, adminCheck, async (_req: Request, res: Response) => {
  try {
    // Delete test matches (matches with no season/tournament, in development)
    const deletedSnapshots = await prisma.matchSnapshot.deleteMany({
      where: {
        match: {
          seasonId: null,
          tournamentId: null,
          status: { in: ['PENDING', 'CANCELLED'] },
        },
      },
    });

    const deletedTrades = await prisma.trade.deleteMany({
      where: {
        match: {
          seasonId: null,
          tournamentId: null,
          status: { in: ['PENDING', 'CANCELLED'] },
        },
      },
    });

    const deletedMatches = await prisma.match.deleteMany({
      where: {
        seasonId: null,
        tournamentId: null,
        status: { in: ['PENDING', 'CANCELLED'] },
      },
    });

    res.json({
      success: true,
      deleted: {
        matches: deletedMatches.count,
        trades: deletedTrades.count,
        snapshots: deletedSnapshots.count,
      },
    });
  } catch (err) {
    console.error('Clear test data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
