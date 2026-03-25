import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncMatchService } from '../../services/asyncMatch';
import { superlativesService } from '../../services/superlatives';
import prisma from '../../lib/prisma';

const router = Router();

// ============================================================
// CHALLENGES
// ============================================================

// POST /api/social/challenge — send a challenge to another user
router.post('/challenge', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { botId, targetUsername } = req.body;
    if (!botId || !targetUsername) {
      res.status(400).json({ error: 'botId and targetUsername required' });
      return;
    }

    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot || bot.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    const target = await prisma.user.findUnique({ where: { username: targetUsername } });
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (target.id === req.user!.userId) {
      res.status(400).json({ error: "Can't challenge yourself" });
      return;
    }

    const result = await asyncMatchService.createChallenge(botId, req.user!.userId, target.id);
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      challengeId: result.challengeId,
      yourScore: result.score?.compositeScore,
      message: `Challenge sent to ${targetUsername}! Your score: ${result.score?.compositeScore}`,
    });
  } catch (err) {
    console.error('Challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/social/challenge/:id/accept — accept a challenge
router.post('/challenge/:id/accept', authMiddleware, async (req: Request, res: Response) => {
  try {
    const challengeId = req.params.id as string;
    const { botId } = req.body;
    if (!botId) {
      res.status(400).json({ error: 'botId required' });
      return;
    }

    const result = await asyncMatchService.acceptChallenge(challengeId, botId, req.user!.userId);
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      winner: result.winner,
      challengerScore: result.challengerScore,
      defenderScore: result.defenderScore,
      youWon: result.winner === req.user!.userId,
    });
  } catch (err) {
    console.error('Accept challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social/challenges — my pending challenges
router.get('/challenges', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [incoming, outgoing] = await Promise.all([
      prisma.headToHead.findMany({
        where: { targetUserId: req.user!.userId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.headToHead.findMany({
        where: { challengerUserId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    res.json({ incoming, outgoing });
  } catch (err) {
    console.error('Get challenges error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// FRIENDS
// ============================================================

// POST /api/social/friend-request — send friend request
router.post('/friend-request', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    const target = await prisma.user.findUnique({ where: { username } });
    if (!target) { res.status(404).json({ error: 'User not found' }); return; }
    if (target.id === req.user!.userId) { res.status(400).json({ error: "Can't friend yourself" }); return; }

    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: req.user!.userId, toUserId: target.id },
          { fromUserId: target.id, toUserId: req.user!.userId },
        ],
      },
    });
    if (existing) {
      res.status(400).json({ error: 'Request already exists' });
      return;
    }

    await prisma.friendRequest.create({
      data: { fromUserId: req.user!.userId, toUserId: target.id },
    });

    await prisma.notification.create({
      data: {
        userId: target.id,
        type: 'FRIEND_ACTIVITY',
        title: 'Friend Request',
        message: `${req.user!.username} wants to be your friend!`,
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/social/friend-request/:id/accept
router.post('/friend-request/:id/accept', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const request = await prisma.friendRequest.findUnique({ where: { id } });
    if (!request || request.toUserId !== req.user!.userId) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    await prisma.friendRequest.update({ where: { id }, data: { status: 'ACCEPTED' } });

    // Create mutual follows
    await prisma.follow.createMany({
      data: [
        { followerId: request.fromUserId, followingId: request.toUserId },
        { followerId: request.toUserId, followingId: request.fromUserId },
      ],
      skipDuplicates: true,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Accept friend error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social/friends — my friends list
router.get('/friends', authMiddleware, async (req: Request, res: Response) => {
  try {
    const friends = await prisma.friendRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { fromUserId: req.user!.userId },
          { toUserId: req.user!.userId },
        ],
      },
    });

    const friendIds = friends.map(f =>
      f.fromUserId === req.user!.userId ? f.toUserId : f.fromUserId
    );

    const users = await prisma.user.findMany({
      where: { id: { in: friendIds } },
      select: {
        id: true, username: true, displayName: true, elo: true, tier: true,
        totalWins: true, totalLosses: true, totalMatches: true, lastActiveAt: true,
      },
    });

    res.json(users);
  } catch (err) {
    console.error('Get friends error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social/pending-requests — pending friend requests
router.get('/pending-requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: { toUserId: req.user!.userId, status: 'PENDING' },
    });

    // Get usernames
    const fromIds = requests.map(r => r.fromUserId);
    const users = await prisma.user.findMany({
      where: { id: { in: fromIds } },
      select: { id: true, username: true, elo: true, tier: true },
    });

    const result = requests.map(r => ({
      ...r,
      from: users.find(u => u.id === r.fromUserId),
    }));

    res.json(result);
  } catch (err) {
    console.error('Pending requests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// BOT COMPARISON
// ============================================================

// GET /api/social/compare/:botId1/:botId2 — compare two bots
router.get('/compare/:botId1/:botId2', async (req: Request, res: Response) => {
  try {
    const [bot1, bot2] = await Promise.all([
      prisma.bot.findUnique({ where: { id: req.params.botId1 as string }, include: { user: { select: { username: true } } } }),
      prisma.bot.findUnique({ where: { id: req.params.botId2 as string }, include: { user: { select: { username: true } } } }),
    ]);

    if (!bot1 || !bot2) { res.status(404).json({ error: 'Bot not found' }); return; }

    // Head-to-head record
    const h2h = await prisma.match.findMany({
      where: {
        status: 'COMPLETED',
        OR: [
          { bot1Id: bot1.id, bot2Id: bot2.id },
          { bot1Id: bot2.id, bot2Id: bot1.id },
        ],
      },
    });

    let bot1Wins = 0, bot2Wins = 0, draws = 0;
    for (const m of h2h) {
      if (!m.winnerId) draws++;
      else if ((m.bot1Id === bot1.id && m.winnerId === m.bot1Id) || (m.bot2Id === bot1.id && m.winnerId === m.bot2Id)) bot1Wins++;
      else bot2Wins++;
    }

    // Get superlatives
    const [sup1, sup2] = await Promise.all([
      superlativesService.getBotSuperlatives(bot1.id),
      superlativesService.getBotSuperlatives(bot2.id),
    ]);

    res.json({
      bot1: {
        ...bot1,
        winRate: bot1.totalMatches > 0 ? (bot1.totalWins / bot1.totalMatches * 100) : 0,
        superlatives: sup1,
      },
      bot2: {
        ...bot2,
        winRate: bot2.totalMatches > 0 ? (bot2.totalWins / bot2.totalMatches * 100) : 0,
        superlatives: sup2,
      },
      headToHead: { bot1Wins, bot2Wins, draws, totalMatches: h2h.length },
    });
  } catch (err) {
    console.error('Compare bots error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// SUPERLATIVES
// ============================================================

// GET /api/social/superlatives/:botId — get bot superlatives
router.get('/superlatives/:botId', async (req: Request, res: Response) => {
  try {
    const superlatives = await superlativesService.getBotSuperlatives(req.params.botId as string);
    res.json(superlatives);
  } catch (err) {
    console.error('Superlatives error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social/superlatives — global superlatives (best of each category)
router.get('/superlatives', async (_req: Request, res: Response) => {
  try {
    const superlatives = await superlativesService.getGlobalSuperlatives();
    res.json(superlatives);
  } catch (err) {
    console.error('Global superlatives error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// RANKED STATS (real market hours only)
// ============================================================

// GET /api/social/ranked-leaderboard — leaderboard based on market hours performance
router.get('/ranked-leaderboard', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 25;

    // Get users with most ranked matches and best performance
    const users = await prisma.user.findMany({
      where: { totalMatches: { gte: 1 } },
      select: {
        id: true, username: true, displayName: true, elo: true, tier: true,
        totalWins: true, totalLosses: true, totalMatches: true,
      },
      orderBy: { elo: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const ranked = users.map((u, i) => ({
      rank: (page - 1) * limit + i + 1,
      ...u,
      winRate: u.totalMatches > 0 ? Math.round((u.totalWins / u.totalMatches) * 1000) / 10 : 0,
    }));

    res.json(ranked);
  } catch (err) {
    console.error('Ranked leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
