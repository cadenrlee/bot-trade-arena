import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

// GET /api/users/me — current user profile (authed)
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        plan: true,
        elo: true,
        tier: true,
        totalWins: true,
        totalLosses: true,
        totalMatches: true,
        createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/me — update profile (authed)
router.patch('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        plan: true,
        elo: true,
        tier: true,
        totalWins: true,
        totalLosses: true,
        totalMatches: true,
        createdAt: true,
      },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/me/followers — my followers (authed)
router.get('/me/followers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const followers = await prisma.follow.findMany({
      where: { followingId: req.user!.userId },
      include: {
        follower: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, elo: true, tier: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.follow.count({ where: { followingId: req.user!.userId } });

    res.json({
      data: followers.map((f) => f.follower),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get followers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/me/following — who I follow (authed)
router.get('/me/following', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const following = await prisma.follow.findMany({
      where: { followerId: req.user!.userId },
      include: {
        following: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, elo: true, tier: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.follow.count({ where: { followerId: req.user!.userId } });

    res.json({
      data: following.map((f) => f.following),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get following error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/me/achievements — my achievements (authed)
router.get('/me/achievements', authMiddleware, async (req: Request, res: Response) => {
  try {
    const achievements = await prisma.userAchievement.findMany({
      where: { userId: req.user!.userId },
      include: {
        achievement: true,
      },
      orderBy: { unlockedAt: 'desc' },
    });

    res.json(achievements.map((ua) => ({
      ...ua.achievement,
      unlockedAt: ua.unlockedAt,
    })));
  } catch (err) {
    console.error('Get achievements error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:username — public profile with stats
router.get('/:username', async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        elo: true,
        tier: true,
        totalWins: true,
        totalLosses: true,
        totalMatches: true,
        createdAt: true,
        clanMembership: {
          include: {
            clan: { select: { id: true, name: true, tag: true } },
          },
        },
        _count: {
          select: {
            follows: true,
            followers: true,
          },
        },
      },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      ...user,
      followingCount: user._count.follows,
      followersCount: user._count.followers,
      _count: undefined,
    });
  } catch (err) {
    console.error('Get public profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:username/bots — user's public bots
router.get('/:username/bots', async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const bots = await prisma.bot.findMany({
      where: { userId: user.id, isPublic: true },
      select: {
        id: true,
        name: true,
        description: true,
        language: true,
        elo: true,
        totalMatches: true,
        totalWins: true,
        totalLosses: true,
        totalDraws: true,
        avgScore: true,
        bestScore: true,
        winStreak: true,
        bestWinStreak: true,
        createdAt: true,
      },
      orderBy: { elo: 'desc' },
    });

    res.json(bots);
  } catch (err) {
    console.error('Get user bots error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/:username/follow — follow user (authed)
router.post('/:username/follow', authMiddleware, async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;
    const target = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (target.id === req.user!.userId) {
      res.status(400).json({ error: 'Cannot follow yourself' });
      return;
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.user!.userId, followingId: target.id } },
    });
    if (existing) {
      res.status(409).json({ error: 'Already following this user' });
      return;
    }

    await prisma.follow.create({
      data: { followerId: req.user!.userId, followingId: target.id },
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Follow user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:username/follow — unfollow user (authed)
router.delete('/:username/follow', authMiddleware, async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;
    const target = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.user!.userId, followingId: target.id } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not following this user' });
      return;
    }

    await prisma.follow.delete({
      where: { id: existing.id },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Unfollow user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
