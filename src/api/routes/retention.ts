import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { streakService } from '../../services/streakService';
import { questService } from '../../services/questService';
import { xpService } from '../../services/xpService';
import { achievementService } from '../../services/achievementService';
import { eloDecayService } from '../../services/eloDecayService';

const router = Router();

// ============================================================
// STREAKS
// ============================================================

// GET /api/retention/streak
router.get('/streak', authMiddleware, async (req: Request, res: Response) => {
  try {
    const streak = await streakService.getStreak(req.user!.userId);
    res.json(streak);
  } catch (err) {
    console.error('Get streak error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/retention/streak/freeze
router.post('/streak/freeze', authMiddleware, async (req: Request, res: Response) => {
  try {
    const success = await streakService.useFreeze(req.user!.userId);
    res.json({ success });
  } catch (err) {
    console.error('Use freeze error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/retention/streak/restore
router.post('/streak/restore', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await streakService.restoreStreak(req.user!.userId);
    res.json(result);
  } catch (err) {
    console.error('Restore streak error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// DAILY QUESTS
// ============================================================

// GET /api/retention/quests
router.get('/quests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const quests = await questService.getQuests(req.user!.userId);
    res.json(quests);
  } catch (err) {
    console.error('Get quests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// XP & LEVELS
// ============================================================

// GET /api/retention/xp
router.get('/xp', authMiddleware, async (req: Request, res: Response) => {
  try {
    const xp = await xpService.getXpInfo(req.user!.userId);
    res.json(xp);
  } catch (err) {
    console.error('Get XP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// ACHIEVEMENTS
// ============================================================

// GET /api/retention/achievements
router.get('/achievements', authMiddleware, async (req: Request, res: Response) => {
  try {
    const achievements = await achievementService.getUserAchievements(req.user!.userId);
    res.json(achievements);
  } catch (err) {
    console.error('Get achievements error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/retention/achievements/seed (admin)
router.post('/achievements/seed', async (_req: Request, res: Response) => {
  try {
    const count = await achievementService.seedAchievements();
    res.json({ seeded: count });
  } catch (err) {
    console.error('Seed achievements error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// ELO DECAY
// ============================================================

// GET /api/retention/decay
router.get('/decay', authMiddleware, async (req: Request, res: Response) => {
  try {
    const status = await eloDecayService.getDecayStatus(req.user!.userId);
    res.json(status);
  } catch (err) {
    console.error('Get decay error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
