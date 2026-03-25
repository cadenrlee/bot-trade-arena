import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import prisma from '../../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All bot routes require auth
router.use(authMiddleware);

const createBotSchema = z.object({
  name: z.string().min(2).max(32),
  description: z.string().max(500).optional(),
  language: z.string().min(1).max(20),
  isPublic: z.boolean().optional(),
});

const updateBotSchema = z.object({
  name: z.string().min(2).max(32).optional(),
  description: z.string().max(500).optional(),
  language: z.string().min(1).max(20).optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
  brokerPlatform: z.string().optional(),
  brokerApiKey: z.string().optional(),
  brokerApiSecret: z.string().optional(),
  brokerPaper: z.boolean().optional(),
});

// GET /api/bots — list my bots
router.get('/', async (req: Request, res: Response) => {
  try {
    const bots = await prisma.bot.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bots.map(sanitizeBot));
  } catch (err) {
    console.error('List bots error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bots — create a new bot
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createBotSchema.parse(req.body);

    // Limit: max 5 bots for free users
    const count = await prisma.bot.count({ where: { userId: req.user!.userId } });
    if (count >= 5) {
      res.status(403).json({ error: 'Max 5 bots per account. Upgrade for more.' });
      return;
    }

    const bot = await prisma.bot.create({
      data: {
        ...data,
        userId: req.user!.userId,
      },
    });

    res.status(201).json(sanitizeBot(bot));
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Create bot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bots/:botId
router.get('/:botId', async (req: Request, res: Response) => {
  try {
    const botId = req.params.botId as string;
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot || bot.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }
    res.json(sanitizeBot(bot));
  } catch (err) {
    console.error('Get bot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/bots/:botId
router.patch('/:botId', async (req: Request, res: Response) => {
  try {
    const botId = req.params.botId as string;
    const data = updateBotSchema.parse(req.body);
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot || bot.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    const updated = await prisma.bot.update({
      where: { id: botId },
      data,
    });
    res.json(sanitizeBot(updated));
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Update bot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/bots/:botId
router.delete('/:botId', async (req: Request, res: Response) => {
  try {
    const botId = req.params.botId as string;
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot || bot.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    // Delete related records first (foreign key constraints)
    await prisma.trade.deleteMany({ where: { botId } });
    await prisma.challengeRun.deleteMany({ where: { botId } });
    await prisma.bot.delete({ where: { id: botId } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete bot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bots/:botId/regenerate-key
router.post('/:botId/regenerate-key', async (req: Request, res: Response) => {
  try {
    const botId = req.params.botId as string;
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot || bot.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    const updated = await prisma.bot.update({
      where: { id: botId },
      data: { apiKey: generateApiKey() },
    });
    res.json({ apiKey: updated.apiKey });
  } catch (err) {
    console.error('Regenerate key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function generateApiKey(): string {
  return `bta_${createId()}${createId()}`;
}

function sanitizeBot(bot: any) {
  return {
    id: bot.id,
    name: bot.name,
    description: bot.description,
    language: bot.language,
    version: bot.version,
    isActive: bot.isActive,
    isPublic: bot.isPublic,
    apiKey: bot.apiKey,
    status: bot.status,
    elo: bot.elo,
    totalMatches: bot.totalMatches,
    totalWins: bot.totalWins,
    totalLosses: bot.totalLosses,
    totalDraws: bot.totalDraws,
    avgScore: bot.avgScore,
    bestScore: bot.bestScore,
    winStreak: bot.winStreak,
    bestWinStreak: bot.bestWinStreak,
    brokerPlatform: bot.brokerPlatform,
    brokerConnected: !!bot.brokerApiKey,
    brokerPaper: bot.brokerPaper,
    createdAt: bot.createdAt,
  };
}

export default router;
