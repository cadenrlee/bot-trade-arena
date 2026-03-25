import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { BOT_TEMPLATES } from '../../services/templateBots';

const router = Router();

// GET /api/templates — list all available bot templates (public)
router.get('/', (_req: Request, res: Response) => {
  res.json(BOT_TEMPLATES);
});

const deploySchema = z.object({
  name: z.string().min(2).max(32),
  templateId: z.string().min(1),
  params: z.record(z.union([z.number(), z.string()])),
});

// POST /api/templates/deploy — create a bot from a template (authed)
router.post('/deploy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = deploySchema.parse(req.body);

    // Validate template exists
    const template = BOT_TEMPLATES.find((t) => t.id === data.templateId);
    if (!template) {
      res.status(400).json({ error: 'Invalid template ID' });
      return;
    }

    // Limit: max 5 bots for free users
    const count = await prisma.bot.count({ where: { userId: req.user!.userId } });
    if (count >= 5) {
      res.status(403).json({ error: 'Max 5 bots per account. Upgrade for more.' });
      return;
    }

    const bot = await prisma.bot.create({
      data: {
        name: data.name,
        language: `template:${data.templateId}`,
        description: JSON.stringify(data.params),
        userId: req.user!.userId,
      },
    });

    res.status(201).json(bot);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Deploy template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
