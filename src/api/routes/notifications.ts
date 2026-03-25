import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { notificationService } from '../../services/notificationService';

const router = Router();

router.use(authMiddleware);

// GET /api/notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const notifications = await notificationService.getRecent(req.user!.userId, page);
    res.json(notifications);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notifications/unread
router.get('/unread', async (req: Request, res: Response) => {
  try {
    const notifications = await notificationService.getUnread(req.user!.userId);
    res.json(notifications);
  } catch (err) {
    console.error('Get unread notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const success = await notificationService.markRead(id, req.user!.userId);
    res.json({ success });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notifications/read-all
router.post('/read-all', async (req: Request, res: Response) => {
  try {
    await notificationService.markAllRead(req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
