import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../lib/config';
import prisma from '../../lib/prisma';

const hits = new Map<string, { count: number; resetAt: number }>();

// Cache user plans to avoid DB lookups on every request
const planCache = new Map<string, { plan: string; expiresAt: number }>();
const PLAN_CACHE_TTL = 60000; // 1 minute

const PLAN_LIMITS: Record<string, number> = {
  FREE: config.rateLimit.maxFree,
  COMPETITOR: 60,
  PRO: config.rateLimit.maxPaid,
};

export async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const now = Date.now();
  const window = config.rateLimit.window;

  // Determine rate limit based on user plan
  let max = PLAN_LIMITS.FREE;
  let key = req.ip || 'unknown';

  // Try to extract user ID from auth header for per-user limits
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), config.jwt.secret) as { userId: string };
      key = `user:${payload.userId}`;

      // Check plan cache
      const cached = planCache.get(payload.userId);
      if (cached && now < cached.expiresAt) {
        max = PLAN_LIMITS[cached.plan] || PLAN_LIMITS.FREE;
      } else {
        // Look up plan from DB
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { plan: true },
        });
        const plan = user?.plan || 'FREE';
        planCache.set(payload.userId, { plan, expiresAt: now + PLAN_CACHE_TTL });
        max = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
      }
    } catch {
      // Invalid token — use IP-based limit
    }
  }

  let entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + window };
    hits.set(key, entry);
  }

  entry.count++;
  res.setHeader('X-RateLimit-Limit', max);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

  if (entry.count > max) {
    res.status(429).json({ error: 'Rate limit exceeded. Upgrade your plan for higher limits.' });
    return;
  }

  next();
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key);
  }
  for (const [key, entry] of planCache) {
    if (now > entry.expiresAt) planCache.delete(key);
  }
}, 300000);
