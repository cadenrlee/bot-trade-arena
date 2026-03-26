import { Router, Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { alpacaStatsService } from '../../services/alpacaStats';

const router = Router();

// In-memory cache for performance leaderboard (refreshes every 5 min)
let cachedLeaderboard: any[] = [];
let lastRefresh = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function refreshLeaderboard() {
  try {
    // Find all bots with broker connections
    const bots = await prisma.bot.findMany({
      where: { brokerApiKey: { not: null }, brokerApiSecret: { not: null } },
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true, elo: true, avatarUrl: true } },
      },
    });

    // Fetch stats for each (with timeout protection)
    const results: any[] = [];
    for (const bot of bots) {
      try {
        const stats = await Promise.race([
          alpacaStatsService.getStats(bot.brokerApiKey!, bot.brokerApiSecret!),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]) as any;

        if (stats && stats.equity > 0) {
          results.push({
            userId: bot.user.id,
            username: bot.user.username,
            displayName: bot.user.displayName,
            tier: bot.user.tier,
            elo: bot.user.elo,
            avatarUrl: bot.user.avatarUrl,
            botName: bot.name,
            // Real trading stats
            equity: stats.equity,
            totalPnl: stats.totalPnl,
            todayPnl: stats.todayPnl,
            todayPnlPct: stats.todayPnlPct,
            winRate: stats.winRate,
            profitFactor: stats.profitFactor,
            totalTrades: stats.totalTrades,
            bestTrade: stats.bestTrade,
            worstTrade: stats.worstTrade,
          });
        }
      } catch {
        // Skip bots with failed API calls
      }
    }

    // Sort by total P&L by default
    results.sort((a, b) => b.totalPnl - a.totalPnl);
    cachedLeaderboard = results;
    lastRefresh = Date.now();
  } catch (err) {
    console.error('Performance leaderboard refresh error:', err);
  }
}

// GET /api/performance-leaderboard
router.get('/', async (req: Request, res: Response) => {
  try {
    // Refresh cache if stale
    if (Date.now() - lastRefresh > CACHE_TTL || cachedLeaderboard.length === 0) {
      await refreshLeaderboard();
    }

    const sortBy = (req.query.sort as string) || 'totalPnl';
    const validSorts = ['totalPnl', 'winRate', 'profitFactor', 'equity', 'todayPnl', 'totalTrades'];
    const sortField = validSorts.includes(sortBy) ? sortBy : 'totalPnl';

    const sorted = [...cachedLeaderboard].sort((a, b) => b[sortField] - a[sortField]);

    res.json({
      data: sorted.map((entry, i) => ({ ...entry, rank: i + 1 })),
      lastRefresh: new Date(lastRefresh).toISOString(),
      totalTraders: sorted.length,
    });
  } catch (err) {
    console.error('Performance leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
