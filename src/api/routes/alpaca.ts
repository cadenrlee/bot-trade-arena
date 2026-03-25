import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { alpacaStatsService } from '../../services/alpacaStats';
import prisma from '../../lib/prisma';

const router = Router();

// GET /api/alpaca/stats/:botId — get real Alpaca trading stats for a bot
router.get('/stats/:botId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const botId = req.params.botId as string;
    const bot = await prisma.bot.findUnique({ where: { id: botId } });

    if (!bot || bot.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    if (!bot.brokerApiKey || !bot.brokerApiSecret) {
      res.status(400).json({ error: 'No broker connected. Go to /bots/connect to link your Alpaca account.' });
      return;
    }

    const stats = await alpacaStatsService.getStats(bot.brokerApiKey, bot.brokerApiSecret);
    res.json(stats);
  } catch (err) {
    console.error('Alpaca stats error:', err);
    res.status(500).json({ error: 'Failed to fetch Alpaca stats' });
  }
});

// GET /api/alpaca/stats-by-keys — get stats with raw keys (for profile display)
router.get('/stats-by-keys', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Find any bot owned by user with broker credentials
    const bot = await prisma.bot.findFirst({
      where: { userId: req.user!.userId, brokerApiKey: { not: null } },
    });

    if (!bot || !bot.brokerApiKey || !bot.brokerApiSecret) {
      res.status(400).json({ error: 'No broker connected' });
      return;
    }

    const stats = await alpacaStatsService.getStats(bot.brokerApiKey, bot.brokerApiSecret);
    res.json(stats);
  } catch (err) {
    console.error('Alpaca stats error:', err);
    res.status(500).json({ error: 'Failed to fetch Alpaca stats' });
  }
});

// GET /api/alpaca/market-status — check if stock market is open
router.get('/market-status', async (_req: Request, res: Response) => {
  try {
    // Use the server's Alpaca keys from env
    const apiKey = process.env.ALPACA_API_KEY;
    const apiSecret = process.env.ALPACA_API_SECRET;

    if (!apiKey || !apiSecret) {
      res.json({ isOpen: false, error: 'No Alpaca keys configured' });
      return;
    }

    const status = await alpacaStatsService.isMarketOpen(apiKey, apiSecret);
    res.json(status);
  } catch (err) {
    console.error('Market status error:', err);
    res.status(500).json({ error: 'Failed to check market status' });
  }
});

// GET /api/alpaca/profile/:username — public trading stats for a user profile
router.get('/profile/:username', async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Find their bot with broker credentials
    const bot = await prisma.bot.findFirst({
      where: { userId: user.id, brokerApiKey: { not: null } },
    });

    if (!bot || !bot.brokerApiKey || !bot.brokerApiSecret) {
      // Return just Arena stats, no Alpaca data
      res.json({ connected: false });
      return;
    }

    const stats = await alpacaStatsService.getStats(bot.brokerApiKey, bot.brokerApiSecret);
    res.json({ connected: true, ...stats });
  } catch (err) {
    console.error('Profile stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
