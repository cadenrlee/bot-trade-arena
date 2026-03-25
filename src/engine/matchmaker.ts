/**
 * Bot Trade Arena — Matchmaker
 *
 * ELO-based matchmaking that:
 *   - Matches bots within similar ELO ranges
 *   - Widens search range over time to prevent long waits
 *   - Respects tier boundaries
 *   - Prevents repeat matchups within a cooldown window
 */

export interface QueuedBot {
  botId: string;
  userId: string;
  elo: number;
  tier: string;
  queuedAt: number; // timestamp
  mode: 'LIVE' | 'ASYNC';
}

export interface MatchPair {
  bot1: QueuedBot;
  bot2: QueuedBot;
  eloGap: number;
}

const INITIAL_ELO_RANGE = 100;     // Start searching within +/- 100 ELO
const ELO_RANGE_EXPANSION = 50;    // Expand by 50 every interval
const EXPANSION_INTERVAL = 10000;  // Expand every 10 seconds
const MAX_ELO_RANGE = 500;         // Never match beyond 500 ELO difference
const REMATCH_COOLDOWN = 300000;   // 5 minutes before rematching same opponent

export class Matchmaker {
  private queue: Map<string, QueuedBot> = new Map();
  private recentMatches: Map<string, number> = new Map(); // "botA-botB" -> timestamp

  /** Add a bot to the matchmaking queue */
  enqueue(bot: QueuedBot): void {
    this.queue.set(bot.botId, bot);
  }

  /** Remove a bot from the queue */
  dequeue(botId: string): void {
    this.queue.delete(botId);
  }

  /** Find the best available match pairs */
  findMatches(): MatchPair[] {
    const pairs: MatchPair[] = [];
    const matched = new Set<string>();
    const now = Date.now();

    // Sort queue by wait time (longest first)
    const sorted = Array.from(this.queue.values())
      .sort((a, b) => a.queuedAt - b.queuedAt);

    for (const bot of sorted) {
      if (matched.has(bot.botId)) continue;

      // Calculate allowed ELO range based on wait time
      const waitTime = now - bot.queuedAt;
      const expansions = Math.floor(waitTime / EXPANSION_INTERVAL);
      const eloRange = Math.min(
        INITIAL_ELO_RANGE + expansions * ELO_RANGE_EXPANSION,
        MAX_ELO_RANGE
      );

      // Find best opponent
      let bestMatch: QueuedBot | null = null;
      let bestGap = Infinity;

      for (const opponent of sorted) {
        if (opponent.botId === bot.botId) continue;
        if (matched.has(opponent.botId)) continue;
        if (opponent.userId === bot.userId) continue; // Can't match against yourself
        if (opponent.mode !== bot.mode) continue;     // Must be same mode

        const gap = Math.abs(bot.elo - opponent.elo);
        if (gap > eloRange) continue;

        // Check rematch cooldown
        const matchKey = [bot.botId, opponent.botId].sort().join('-');
        const lastMatch = this.recentMatches.get(matchKey);
        if (lastMatch && now - lastMatch < REMATCH_COOLDOWN) continue;

        if (gap < bestGap) {
          bestGap = gap;
          bestMatch = opponent;
        }
      }

      if (bestMatch) {
        pairs.push({ bot1: bot, bot2: bestMatch, eloGap: bestGap });
        matched.add(bot.botId);
        matched.add(bestMatch.botId);

        // Record the match
        const matchKey = [bot.botId, bestMatch.botId].sort().join('-');
        this.recentMatches.set(matchKey, now);
      }
    }

    // Remove matched bots from queue
    for (const id of matched) {
      this.queue.delete(id);
    }

    return pairs;
  }

  /** Get queue stats */
  getQueueStats() {
    const bots = Array.from(this.queue.values());
    const tiers: Record<string, number> = {};
    for (const bot of bots) {
      tiers[bot.tier] = (tiers[bot.tier] || 0) + 1;
    }
    return {
      totalInQueue: bots.length,
      byTier: tiers,
      avgWaitTime: bots.length > 0
        ? Math.round((Date.now() - Math.min(...bots.map(b => b.queuedAt))) / 1000)
        : 0,
    };
  }

  /** Clean up old rematch records */
  cleanup(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.recentMatches) {
      if (now - timestamp > REMATCH_COOLDOWN * 2) {
        this.recentMatches.delete(key);
      }
    }
  }
}
