import { Router, Request, Response } from 'express';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import prisma from '../../lib/prisma';
import { alpacaStatsService } from '../../services/alpacaStats';

const router = Router();

// GET /api/feed — public feed of recent posts
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;

    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true, elo: true, avatarUrl: true } },
        likes: req.user ? { where: { userId: req.user.userId as string }, select: { id: true } } : false,
        comments: {
          orderBy: { createdAt: 'asc' },
          take: 3,
          include: {
            user: { select: { username: true, displayName: true, tier: true } } as any,
          },
        },
      },
    });

    const total = await prisma.post.count();

    const enriched = posts.map((post: any) => ({
      ...post,
      isLiked: req.user ? post.likes?.length > 0 : false,
      likes: undefined, // Don't send raw likes array
    }));

    res.json({
      data: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// GET /api/feed/user/:username — posts by a specific user
router.get('/user/:username', optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username as string } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const posts = await prisma.post.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true, elo: true, avatarUrl: true } },
        likes: req.user ? { where: { userId: req.user.userId as string }, select: { id: true } } : false,
        comments: {
          orderBy: { createdAt: 'asc' },
          take: 3,
          include: {
            user: { select: { username: true, displayName: true, tier: true } } as any,
          },
        },
      },
    });

    res.json(posts.map((post: any) => ({
      ...post,
      isLiked: req.user ? post.likes?.length > 0 : false,
      likes: undefined,
    })));
  } catch (err) {
    console.error('User feed error:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST /api/feed — create a post
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content, type, attachStats } = req.body;
    if (!content || content.trim().length === 0) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    if (content.length > 500) {
      res.status(400).json({ error: 'Content must be under 500 characters' });
      return;
    }

    let statsSnapshot: string | undefined;

    // If user wants to attach their current Alpaca stats
    if (attachStats) {
      try {
        const bot = await prisma.bot.findFirst({
          where: { userId: req.user!.userId, brokerApiKey: { not: null } },
        });
        if (bot?.brokerApiKey && bot?.brokerApiSecret) {
          const stats = await alpacaStatsService.getStats(bot.brokerApiKey, bot.brokerApiSecret);
          statsSnapshot = JSON.stringify({
            equity: stats.equity,
            totalPnl: stats.totalPnl,
            todayPnl: stats.todayPnl,
            todayPnlPct: stats.todayPnlPct,
            winRate: stats.winRate,
            profitFactor: stats.profitFactor,
            totalTrades: stats.totalTrades,
            topSymbols: stats.topSymbols.slice(0, 5),
            equityCurve: stats.equityCurve.slice(-14), // Last 14 days
          });
        }
      } catch { /* Stats attachment optional */ }
    }

    const post = await prisma.post.create({
      data: {
        userId: req.user!.userId as string,
        content: content.trim(),
        type: type || 'TEXT',
        statsSnapshot,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true, elo: true, avatarUrl: true } },
      },
    });

    res.status(201).json(post);
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// POST /api/feed/:id/like — toggle like
router.post('/:id/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.userId as string;

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
      await prisma.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } });
      res.json({ liked: false });
    } else {
      await prisma.postLike.create({ data: { postId, userId } });
      await prisma.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });
      res.json({ liked: true });
    }
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// POST /api/feed/:id/comment — add comment
router.post('/:id/comment', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      res.status(400).json({ error: 'Comment is required' });
      return;
    }
    if (content.length > 300) {
      res.status(400).json({ error: 'Comment must be under 300 characters' });
      return;
    }

    const comment = await prisma.postComment.create({
      data: {
        postId: req.params.id as string,
        userId: req.user!.userId as string,
        content: content.trim(),
      },
    });
    await prisma.post.update({ where: { id: req.params.id as string }, data: { commentCount: { increment: 1 } } });

    res.status(201).json(comment);
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// GET /api/feed/:id/comments — get all comments for a post
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const comments = await prisma.postComment.findMany({
      where: { postId: req.params.id as string },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { username: true, displayName: true, tier: true } },
      },
    });
    res.json(comments);
  } catch (err) {
    console.error('Comments error:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// DELETE /api/feed/:id — delete own post
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id as string } });
    if (!post || post.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    await prisma.post.delete({ where: { id: req.params.id as string } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;
