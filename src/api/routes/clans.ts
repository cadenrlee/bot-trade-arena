import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const createClanSchema = z.object({
  name: z.string().min(2).max(32),
  tag: z.string().min(2).max(6).regex(/^[A-Za-z0-9]+$/),
  description: z.string().max(500).optional(),
});

const updateClanSchema = z.object({
  name: z.string().min(2).max(32).optional(),
  description: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

// GET /api/clans — list clans
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const [clans, total] = await Promise.all([
      prisma.clan.findMany({
        select: {
          id: true,
          name: true,
          tag: true,
          description: true,
          avatarUrl: true,
          avgElo: true,
          totalWins: true,
          totalMatches: true,
          _count: { select: { members: true } },
          createdAt: true,
        },
        orderBy: { avgElo: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.clan.count(),
    ]);

    const data = clans.map((c) => ({
      id: c.id,
      name: c.name,
      tag: c.tag,
      description: c.description,
      avatarUrl: c.avatarUrl,
      avgElo: c.avgElo,
      totalWins: c.totalWins,
      totalMatches: c.totalMatches,
      memberCount: c._count.members,
      createdAt: c.createdAt,
    }));

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('List clans error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clans — create clan (authed)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = createClanSchema.parse(req.body);

    // Check the user isn't already in a clan
    const existingMembership = await prisma.clanMember.findUnique({
      where: { userId: req.user!.userId },
    });
    if (existingMembership) {
      res.status(400).json({ error: 'You must leave your current clan before creating a new one' });
      return;
    }

    // Check name/tag uniqueness
    const existing = await prisma.clan.findFirst({
      where: { OR: [{ name: data.name }, { tag: data.tag.toUpperCase() }] },
    });
    if (existing) {
      res.status(409).json({
        error: existing.name === data.name ? 'Clan name already taken' : 'Clan tag already taken',
      });
      return;
    }

    const clan = await prisma.clan.create({
      data: {
        name: data.name,
        tag: data.tag.toUpperCase(),
        description: data.description,
        ownerId: req.user!.userId,
      },
    });

    // Auto-join the creator as OWNER
    await prisma.clanMember.create({
      data: {
        userId: req.user!.userId,
        clanId: clan.id,
        role: 'OWNER',
      },
    });

    res.status(201).json(clan);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Create clan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/clans/:id — clan details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const clan = await prisma.clan.findUnique({
      where: { id },
      include: {
        _count: { select: { members: true } },
      },
    });

    if (!clan) {
      res.status(404).json({ error: 'Clan not found' });
      return;
    }

    res.json({
      id: clan.id,
      name: clan.name,
      tag: clan.tag,
      description: clan.description,
      avatarUrl: clan.avatarUrl,
      ownerId: clan.ownerId,
      avgElo: clan.avgElo,
      totalWins: clan.totalWins,
      totalMatches: clan.totalMatches,
      memberCount: clan._count.members,
      createdAt: clan.createdAt,
    });
  } catch (err) {
    console.error('Get clan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/clans/:id — update clan (owner only)
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = updateClanSchema.parse(req.body);

    const clan = await prisma.clan.findUnique({ where: { id } });
    if (!clan) {
      res.status(404).json({ error: 'Clan not found' });
      return;
    }
    if (clan.ownerId !== req.user!.userId) {
      res.status(403).json({ error: 'Only the clan owner can update clan settings' });
      return;
    }

    const updated = await prisma.clan.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Update clan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clans/:id/join — join clan (authed)
router.post('/:id/join', authMiddleware, async (req: Request, res: Response) => {
  try {
    const clanId = req.params.id as string;

    const clan = await prisma.clan.findUnique({ where: { id: clanId } });
    if (!clan) {
      res.status(404).json({ error: 'Clan not found' });
      return;
    }

    // Check if user is already in a clan
    const existingMembership = await prisma.clanMember.findUnique({
      where: { userId: req.user!.userId },
    });
    if (existingMembership) {
      if (existingMembership.clanId === clanId) {
        res.status(409).json({ error: 'Already a member of this clan' });
      } else {
        res.status(400).json({ error: 'You must leave your current clan first' });
      }
      return;
    }

    const member = await prisma.clanMember.create({
      data: {
        userId: req.user!.userId,
        clanId,
        role: 'MEMBER',
      },
    });

    res.status(201).json(member);
  } catch (err) {
    console.error('Join clan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/clans/:id/leave — leave clan (authed)
router.delete('/:id/leave', authMiddleware, async (req: Request, res: Response) => {
  try {
    const clanId = req.params.id as string;

    const membership = await prisma.clanMember.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!membership || membership.clanId !== clanId) {
      res.status(404).json({ error: 'Not a member of this clan' });
      return;
    }

    const clan = await prisma.clan.findUnique({ where: { id: clanId } });
    if (clan && clan.ownerId === req.user!.userId) {
      res.status(400).json({ error: 'Clan owner cannot leave. Transfer ownership or disband the clan first.' });
      return;
    }

    await prisma.clanMember.delete({ where: { id: membership.id } });

    res.json({ success: true });
  } catch (err) {
    console.error('Leave clan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/clans/:id/members — clan members
router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const clanId = req.params.id as string;

    const clan = await prisma.clan.findUnique({ where: { id: clanId } });
    if (!clan) {
      res.status(404).json({ error: 'Clan not found' });
      return;
    }

    const members = await prisma.clanMember.findMany({
      where: { clanId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            elo: true,
            tier: true,
            totalWins: true,
            totalMatches: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    res.json(members.map((m) => ({
      ...m.user,
      role: m.role,
      joinedAt: m.joinedAt,
    })));
  } catch (err) {
    console.error('Clan members error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/clans/:id/stats — clan aggregate stats
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const clanId = req.params.id as string;

    const clan = await prisma.clan.findUnique({
      where: { id: clanId },
      include: {
        members: {
          include: {
            user: {
              select: { elo: true, totalWins: true, totalLosses: true, totalMatches: true },
            },
          },
        },
      },
    });

    if (!clan) {
      res.status(404).json({ error: 'Clan not found' });
      return;
    }

    const memberStats = clan.members.map((m) => m.user);
    const totalMembers = memberStats.length;

    const aggregated = memberStats.reduce(
      (acc, u) => ({
        totalElo: acc.totalElo + u.elo,
        totalWins: acc.totalWins + u.totalWins,
        totalLosses: acc.totalLosses + u.totalLosses,
        totalMatches: acc.totalMatches + u.totalMatches,
      }),
      { totalElo: 0, totalWins: 0, totalLosses: 0, totalMatches: 0 },
    );

    res.json({
      clanId: clan.id,
      name: clan.name,
      tag: clan.tag,
      totalMembers,
      avgElo: totalMembers > 0 ? Math.round(aggregated.totalElo / totalMembers) : 0,
      totalWins: aggregated.totalWins,
      totalLosses: aggregated.totalLosses,
      totalMatches: aggregated.totalMatches,
      winRate: aggregated.totalMatches > 0
        ? Math.round((aggregated.totalWins / aggregated.totalMatches) * 10000) / 100
        : 0,
    });
  } catch (err) {
    console.error('Clan stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// CLAN CHAT
// ============================================================

const sendMessageSchema = z.object({
  content: z.string().min(1).max(500),
});

// GET /api/clans/:id/messages — Get last 50 messages
router.get('/:id/messages', authMiddleware, async (req: Request, res: Response) => {
  try {
    const clanId = req.params.id as string;

    // Verify the user is a member of this clan
    const membership = await prisma.clanMember.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!membership || membership.clanId !== clanId) {
      res.status(403).json({ error: 'You must be a clan member to view messages' });
      return;
    }

    const messages = await prisma.clanMessage.findMany({
      where: { clanId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Return in chronological order (oldest first)
    res.json(messages.reverse());
  } catch (err) {
    console.error('Get clan messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clans/:id/messages — Send a message
router.post('/:id/messages', authMiddleware, async (req: Request, res: Response) => {
  try {
    const clanId = req.params.id as string;
    const { content } = sendMessageSchema.parse(req.body);

    // Verify the user is a member of this clan
    const membership = await prisma.clanMember.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!membership || membership.clanId !== clanId) {
      res.status(403).json({ error: 'You must be a clan member to send messages' });
      return;
    }

    const message = await prisma.clanMessage.create({
      data: {
        clanId,
        userId: req.user!.userId,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.status(201).json(message);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Send clan message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
