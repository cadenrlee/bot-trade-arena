import { Router, Request, Response } from 'express';
import prisma from '../../lib/prisma';

const router = Router();

function parsePagination(query: Record<string, any>) {
  const page = parseInt(query.page as string) || 1;
  const limit = Math.min(parseInt(query.limit as string) || 50, 100);
  return { page, limit, skip: (page - 1) * limit };
}

function parseTierFilter(query: Record<string, any>): string | undefined {
  const tier = query.tier as string | undefined;
  if (tier && ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER'].includes(tier.toUpperCase())) {
    return tier.toUpperCase();
  }
  return undefined;
}

// GET /api/leaderboards/daily — today's leaderboard
router.get('/daily', async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const tier = parseTierFilter(req.query);

    const where: Record<string, any> = {};
    if (tier) where.tier = tier;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          elo: true,
          tier: true,
          totalWins: true,
          totalLosses: true,
          totalMatches: true,
        },
        orderBy: { elo: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const entries = users.map((user, idx) => ({
      rank: skip + idx + 1,
      ...user,
    }));

    res.json({
      period: 'DAILY',
      data: entries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Daily leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboards/weekly — this week's leaderboard
router.get('/weekly', async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const tier = parseTierFilter(req.query);

    const where: Record<string, any> = {};
    if (tier) where.tier = tier;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          elo: true,
          tier: true,
          totalWins: true,
          totalLosses: true,
          totalMatches: true,
        },
        orderBy: { elo: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const entries = users.map((user, idx) => ({
      rank: skip + idx + 1,
      ...user,
    }));

    res.json({
      period: 'WEEKLY',
      data: entries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Weekly leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboards/monthly — this month's leaderboard
router.get('/monthly', async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const tier = parseTierFilter(req.query);

    const where: Record<string, any> = {};
    if (tier) where.tier = tier;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          elo: true,
          tier: true,
          totalWins: true,
          totalLosses: true,
          totalMatches: true,
        },
        orderBy: { elo: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const entries = users.map((user, idx) => ({
      rank: skip + idx + 1,
      ...user,
    }));

    res.json({
      period: 'MONTHLY',
      data: entries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Monthly leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboards/season — current season leaderboard
router.get('/season', async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const tier = parseTierFilter(req.query);

    const currentSeason = await prisma.season.findFirst({
      where: { isActive: true },
      select: { id: true, name: true, number: true },
    });

    if (!currentSeason) {
      res.json({ period: 'SEASON', season: null, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      return;
    }

    const where: Record<string, any> = { seasonId: currentSeason.id };
    if (tier) where.tier = tier;

    const [entries, total] = await Promise.all([
      prisma.seasonEntry.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
        orderBy: { elo: 'desc' },
        skip,
        take: limit,
      }),
      prisma.seasonEntry.count({ where }),
    ]);

    const data = entries.map((entry, idx) => ({
      rank: skip + idx + 1,
      ...entry.user,
      elo: entry.elo,
      tier: entry.tier,
      wins: entry.wins,
      losses: entry.losses,
      draws: entry.draws,
      avgScore: entry.avgScore,
      peakElo: entry.peakElo,
    }));

    res.json({
      period: 'SEASON',
      season: currentSeason,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Season leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboards/all-time — all-time leaderboard
router.get('/all-time', async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const tier = parseTierFilter(req.query);

    const where: Record<string, any> = {};
    if (tier) where.tier = tier;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          elo: true,
          tier: true,
          totalWins: true,
          totalLosses: true,
          totalMatches: true,
        },
        orderBy: { elo: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const entries = users.map((user, idx) => ({
      rank: skip + idx + 1,
      ...user,
    }));

    res.json({
      period: 'ALL_TIME',
      data: entries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('All-time leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboards/clans — clan leaderboard
router.get('/clans', async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [clans, total] = await Promise.all([
      prisma.clan.findMany({
        select: {
          id: true,
          name: true,
          tag: true,
          avatarUrl: true,
          avgElo: true,
          totalWins: true,
          totalMatches: true,
          _count: { select: { members: true } },
        },
        orderBy: { avgElo: 'desc' },
        skip,
        take: limit,
      }),
      prisma.clan.count(),
    ]);

    const entries = clans.map((clan, idx) => ({
      rank: skip + idx + 1,
      id: clan.id,
      name: clan.name,
      tag: clan.tag,
      avatarUrl: clan.avatarUrl,
      avgElo: clan.avgElo,
      totalWins: clan.totalWins,
      totalMatches: clan.totalMatches,
      memberCount: clan._count.members,
    }));

    res.json({
      period: 'CLANS',
      data: entries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Clan leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
