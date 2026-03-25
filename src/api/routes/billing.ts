import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

const PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    price: 0,
    interval: null,
    features: [
      'Up to 5 bots',
      'Ladder matches',
      'Basic analytics',
      '30 API requests/min',
    ],
  },
  {
    id: 'COMPETITOR',
    name: 'Competitor',
    price: 9.99,
    interval: 'month',
    features: [
      'Up to 15 bots',
      'Ladder + tournament access',
      'Advanced analytics',
      'Priority matchmaking',
      '60 API requests/min',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 24.99,
    interval: 'month',
    features: [
      'Unlimited bots',
      'All game modes',
      'Full analytics suite',
      'Custom match durations',
      'Priority support',
      '120 API requests/min',
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const subscribeSchema = z.object({
  planId: z.enum(['COMPETITOR', 'PRO']),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/billing/plans — return available plans
router.get('/plans', (_req: Request, res: Response) => {
  res.json(PLANS);
});

// POST /api/billing/subscribe — stub
router.post('/subscribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { planId } = subscribeSchema.parse(req.body);

    // Stub: In production, this would create a Stripe Checkout session
    res.json({
      success: true,
      message: `Subscribed to ${planId} plan (stub)`,
      plan: PLANS.find((p) => p.id === planId),
      userId: req.user!.userId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/billing/cancel — stub
router.post('/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Stub: In production, this would cancel the Stripe subscription
    res.json({
      success: true,
      message: 'Subscription cancelled (stub)',
      userId: req.user!.userId,
    });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/billing/invoices — stub empty array
router.get('/invoices', authMiddleware, async (_req: Request, res: Response) => {
  try {
    // Stub: In production, this would fetch invoices from Stripe
    res.json([]);
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/billing/webhook — Stripe webhook handler stub
router.post('/webhook', (req: Request, res: Response) => {
  try {
    // Stub: In production, this would verify the Stripe signature and
    // process events like checkout.session.completed, invoice.paid,
    // customer.subscription.deleted, etc.

    const event = req.body;
    console.log('Stripe webhook received (stub):', event?.type ?? 'unknown');

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
