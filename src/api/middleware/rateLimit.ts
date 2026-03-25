import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../lib/config';

/**
 * High-performance rate limiter.
 * - Zero DB calls — plan is extracted from JWT payload
 * - O(1) Map lookups
 * - Automatic cleanup of stale entries
 */

const hits = new Map<string, { count: number; resetAt: number }>();

const PLAN_LIMITS: Record<string, number> = {
  FREE: config.rateLimit.maxFree,
  COMPETITOR: 60,
  PRO: config.rateLimit.maxPaid,
  ENTERPRISE: 300,
};

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const window = config.rateLimit.window;

  let max = PLAN_LIMITS.FREE;
  let key = req.ip || 'unknown';

  // Extract plan from JWT without DB call
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), config.jwt.secret) as any;
      key = `u:${payload.userId}`;
      // If plan is encoded in token, use it; otherwise default to FREE
      if (payload.plan && PLAN_LIMITS[payload.plan]) {
        max = PLAN_LIMITS[payload.plan];
      }
    } catch {
      // Invalid/expired token — IP-based limit
    }
  }

  let entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + window };
    hits.set(key, entry);
  } else {
    entry.count++;
  }

  res.setHeader('X-RateLimit-Limit', max);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));

  if (entry.count > max) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  next();
}

// Cleanup every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key);
  }
}, 120000);
