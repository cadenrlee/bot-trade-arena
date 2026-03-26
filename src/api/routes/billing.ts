import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { config } from '../../lib/config';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// Stripe client
// ---------------------------------------------------------------------------

// Lazy-init Stripe so missing keys don't crash the whole server
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!config.stripe.secretKey) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY env var.');
    }
    _stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2025-02-24.acacia' as any,
    });
  }
  return _stripe;
}

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
    stripePriceId: config.stripe.priceCompetitor,
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
    stripePriceId: config.stripe.pricePro,
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

const PLAN_PRICE_MAP: Record<string, string> = {
  COMPETITOR: config.stripe.priceCompetitor,
  PRO: config.stripe.pricePro,
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const subscribeSchema = z.object({
  planId: z.enum(['COMPETITOR', 'PRO']),
});

const seasonPassSchema = z.object({
  seasonId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  if (user.stripeId) return user.stripeId;

  const customer = await getStripe().customers.create({
    email: user.email,
    metadata: { userId: user.id, username: user.username },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeId: customer.id },
  });

  return customer.id;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/billing/plans — return available plans
router.get('/plans', (_req: Request, res: Response) => {
  res.json(PLANS);
});

// GET /api/billing/status — current user's billing status
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        plan: true,
        stripeId: true,
        planExpiresAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let subscriptionId: string | null = null;
    let subscriptionStatus: string | null = null;

    // Fetch active subscription from Stripe if customer exists
    if (user.stripeId) {
      try {
        const subscriptions = await getStripe().subscriptions.list({
          customer: user.stripeId,
          status: 'active',
          limit: 1,
        });
        if (subscriptions.data.length > 0) {
          subscriptionId = subscriptions.data[0].id;
          subscriptionStatus = subscriptions.data[0].status;
        }
      } catch {
        // Stripe unavailable — continue without subscription details
      }
    }

    res.json({
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
      stripeCustomerId: user.stripeId,
      subscriptionId,
      subscriptionStatus,
    });
  } catch (err) {
    console.error('Billing status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/billing/subscribe — create Stripe Checkout session
router.post('/subscribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { planId } = subscribeSchema.parse(req.body);
    const priceId = PLAN_PRICE_MAP[planId];

    if (!priceId) {
      res.status(400).json({ error: 'Invalid plan' });
      return;
    }

    const customerId = await getOrCreateStripeCustomer(req.user!.userId);

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.corsOrigin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.corsOrigin}/billing?cancelled=true`,
      metadata: {
        userId: req.user!.userId,
        planId,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/billing/cancel — cancel Stripe subscription
router.post('/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { stripeId: true, plan: true },
    });

    if (!user || !user.stripeId) {
      res.status(400).json({ error: 'No active subscription' });
      return;
    }

    if (user.plan === 'FREE') {
      res.status(400).json({ error: 'You are on the free plan' });
      return;
    }

    // Find the active subscription
    const subscriptions = await getStripe().subscriptions.list({
      customer: user.stripeId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      res.status(400).json({ error: 'No active subscription found' });
      return;
    }

    // Cancel at period end so the user keeps access until it expires
    const cancelled = await getStripe().subscriptions.update(subscriptions.data[0].id, {
      cancel_at_period_end: true,
    });

    res.json({
      success: true,
      message: 'Subscription will cancel at end of billing period',
      cancelAt: cancelled.cancel_at ? new Date(cancelled.cancel_at * 1000) : null,
      currentPeriodEnd: new Date(cancelled.current_period_end * 1000),
    });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/billing/invoices — fetch invoices from Stripe
router.get('/invoices', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { stripeId: true },
    });

    if (!user || !user.stripeId) {
      res.json([]);
      return;
    }

    const invoices = await getStripe().invoices.list({
      customer: user.stripeId,
      limit: 20,
    });

    res.json(
      invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amount: inv.amount_due,
        currency: inv.currency,
        created: new Date(inv.created * 1000),
        periodStart: inv.period_start ? new Date(inv.period_start * 1000) : null,
        periodEnd: inv.period_end ? new Date(inv.period_end * 1000) : null,
        pdfUrl: inv.invoice_pdf,
        hostedUrl: inv.hosted_invoice_url,
      })),
    );
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/billing/season-pass — create checkout for season pass
router.post('/season-pass', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { seasonId } = seasonPassSchema.parse(req.body);

    // Verify season exists
    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    // Check if user already has premium season pass
    const existingPass = await prisma.seasonPass.findUnique({
      where: { userId_seasonId: { userId: req.user!.userId, seasonId } },
    });
    if (existingPass?.isPremium) {
      res.status(400).json({ error: 'You already have the premium season pass' });
      return;
    }

    const customerId = await getOrCreateStripeCustomer(req.user!.userId);

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 499, // $4.99 in cents
            product_data: {
              name: `Season Pass — ${season.name}`,
              description: `Premium Season Pass for ${season.name}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${config.corsOrigin}/seasons/${seasonId}?pass=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.corsOrigin}/seasons/${seasonId}?pass=cancelled`,
      metadata: {
        userId: req.user!.userId,
        seasonId,
        type: 'season_pass',
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Season pass error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/billing/webhook — Stripe webhook handler
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return;
  }

  try {
    switch (event.type) {
      // ---------------------------------------------------------------
      // Checkout completed — activate plan or season pass
      // ---------------------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (!userId) {
          console.warn('[Webhook] checkout.session.completed missing userId metadata');
          break;
        }

        // Season pass purchase (one-time payment)
        if (session.metadata?.type === 'season_pass') {
          const seasonId = session.metadata.seasonId;
          if (seasonId) {
            await prisma.seasonPass.upsert({
              where: { userId_seasonId: { userId, seasonId } },
              create: { userId, seasonId, isPremium: true },
              update: { isPremium: true },
            });
            console.log(`[Webhook] Season pass activated for user ${userId}, season ${seasonId}`);
          }
          break;
        }

        // Subscription checkout
        const planId = session.metadata?.planId;
        if (planId && (planId === 'COMPETITOR' || planId === 'PRO')) {
          // Get subscription to find current period end
          let planExpiresAt: Date | null = null;
          if (session.subscription) {
            const sub = await getStripe().subscriptions.retrieve(session.subscription as string);
            planExpiresAt = new Date(sub.current_period_end * 1000);
          }

          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: planId,
              planExpiresAt,
            },
          });
          console.log(`[Webhook] Plan activated: ${planId} for user ${userId}`);
        }
        break;
      }

      // ---------------------------------------------------------------
      // Invoice paid — renew subscription
      // ---------------------------------------------------------------
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        if (!customerId) break;

        const user = await prisma.user.findFirst({
          where: { stripeId: customerId },
        });

        if (!user) {
          console.warn(`[Webhook] invoice.paid — no user for customer ${customerId}`);
          break;
        }

        // Update plan expiry from the subscription's current period end
        if (invoice.subscription) {
          const sub = await getStripe().subscriptions.retrieve(invoice.subscription as string);
          await prisma.user.update({
            where: { id: user.id },
            data: {
              planExpiresAt: new Date(sub.current_period_end * 1000),
            },
          });
          console.log(`[Webhook] Plan renewed for user ${user.id} until ${new Date(sub.current_period_end * 1000).toISOString()}`);
        }
        break;
      }

      // ---------------------------------------------------------------
      // Subscription deleted — downgrade to FREE
      // ---------------------------------------------------------------
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const user = await prisma.user.findFirst({
          where: { stripeId: customerId },
        });

        if (!user) {
          console.warn(`[Webhook] subscription.deleted — no user for customer ${customerId}`);
          break;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: 'FREE',
            planExpiresAt: null,
          },
        });
        console.log(`[Webhook] User ${user.id} downgraded to FREE`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
