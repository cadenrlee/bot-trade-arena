/**
 * Simple in-memory cache with TTL.
 * Used for hot endpoints (leaderboards, live matches, health) to avoid
 * redundant DB queries under load.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private maxSize = 1000;

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  // Remove expired entries
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

export const cache = new MemoryCache();

// Prune expired entries every 60 seconds
setInterval(() => cache.prune(), 60000);

/**
 * Express middleware: cache JSON responses for a given TTL.
 * Only caches GET requests with 200 status.
 */
export function cacheMiddleware(ttlMs: number) {
  return (req: any, res: any, next: any) => {
    if (req.method !== 'GET') return next();

    const key = `route:${req.originalUrl}`;
    const cached = cache.get<{ status: number; body: any }>(key);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.status(cached.status).json(cached.body);
      return;
    }

    // Monkey-patch res.json to intercept the response
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode === 200) {
        cache.set(key, { status: res.statusCode, body }, ttlMs);
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}
