import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { MatchEngine, type MarketTick } from '../engine/match';

/**
 * House Bots — built-in AI opponents so players can always find a match.
 *
 * Three difficulty levels:
 *   - Rookie (Bronze-level, easy to beat)
 *   - Veteran (Gold-level, moderate)
 *   - Elite (Platinum-level, aggressive)
 *
 * Each runs a simple strategy during matches without needing a WebSocket connection.
 */

const HOUSE_USER_ID = 'house-bot-system';

interface HouseBotDef {
  id: string;
  name: string;
  difficulty: 'ROOKIE' | 'VETERAN' | 'ELITE';
  elo: number;
  description: string;
}

const HOUSE_BOTS: HouseBotDef[] = [
  { id: 'house-bot-rookie', name: 'Rookie Bot', difficulty: 'ROOKIE', elo: 900, description: 'A beginner-level bot. Good for your first match.' },
  { id: 'house-bot-veteran', name: 'Veteran Bot', difficulty: 'VETERAN', elo: 1300, description: 'A solid mid-tier opponent. Trades with discipline.' },
  { id: 'house-bot-elite', name: 'Elite Bot', difficulty: 'ELITE', elo: 1700, description: 'An aggressive high-tier bot. Can you beat it?' },
];

export class HouseBotService {
  private priceHistory: Map<string, number[]> = new Map();

  /**
   * Ensure house bot user and bots exist in DB. Call on server startup.
   */
  async initialize(): Promise<void> {
    // Create house user
    const hash = await bcrypt.hash('house-bot-no-login', 12);
    await prisma.user.upsert({
      where: { id: HOUSE_USER_ID },
      update: {},
      create: {
        id: HOUSE_USER_ID,
        email: 'housebot@bottradearena.internal',
        username: 'arena_bots',
        passwordHash: hash,
        displayName: 'Arena House Bots',
        plan: 'PRO',
      },
    });

    // Create each house bot
    for (const def of HOUSE_BOTS) {
      await prisma.bot.upsert({
        where: { id: def.id },
        update: { elo: def.elo },
        create: {
          id: def.id,
          userId: HOUSE_USER_ID,
          name: def.name,
          language: 'system',
          description: def.description,
          elo: def.elo,
          isPublic: true,
        },
      });
    }

    console.log('[HouseBots] 3 house bots ready (Rookie, Veteran, Elite)');
  }

  /**
   * Get available house bots for a given player ELO
   */
  getAvailableBots(): HouseBotDef[] {
    return HOUSE_BOTS;
  }

  /**
   * Get best house bot match for a player's ELO
   */
  getBestMatch(playerElo: number): HouseBotDef {
    let best = HOUSE_BOTS[0];
    let bestGap = Infinity;
    for (const bot of HOUSE_BOTS) {
      const gap = Math.abs(bot.elo - playerElo);
      if (gap < bestGap) {
        bestGap = gap;
        best = bot;
      }
    }
    return best;
  }

  getHouseUserId(): string {
    return HOUSE_USER_ID;
  }

  isHouseBot(botId: string): boolean {
    return HOUSE_BOTS.some(b => b.id === botId);
  }

  getDifficulty(botId: string): 'ROOKIE' | 'VETERAN' | 'ELITE' {
    return HOUSE_BOTS.find(b => b.id === botId)?.difficulty || 'ROOKIE';
  }

  /**
   * Drive the house bot's trading during a match.
   * Call this on every market tick.
   */
  onTick(engine: MatchEngine, houseBotId: string, tick: MarketTick): void {
    const difficulty = this.getDifficulty(houseBotId);
    const { symbol, price } = tick;

    // Track price history
    const key = `${houseBotId}:${symbol}`;
    if (!this.priceHistory.has(key)) this.priceHistory.set(key, []);
    const history = this.priceHistory.get(key)!;
    history.push(price);
    if (history.length > 30) history.shift();

    // Need enough data
    const minHistory = difficulty === 'ROOKIE' ? 10 : difficulty === 'VETERAN' ? 8 : 5;
    if (history.length < minHistory) return;

    // Calculate signals
    const mean = history.reduce((s, p) => s + p, 0) / history.length;
    const recentMean = history.slice(-5).reduce((s, p) => s + p, 0) / 5;
    const momentum = ((recentMean - mean) / mean) * 100;

    // Trade probability based on difficulty (higher = more active)
    const tradeChance = difficulty === 'ROOKIE' ? 0.08 : difficulty === 'VETERAN' ? 0.12 : 0.18;
    if (Math.random() > tradeChance) return;

    // Position sizing based on difficulty
    const sizePct = difficulty === 'ROOKIE' ? 0.05 : difficulty === 'VETERAN' ? 0.1 : 0.15;

    // Strategy varies by difficulty
    if (difficulty === 'ROOKIE') {
      // Rookie: random with slight momentum following, often wrong
      if (Math.random() > 0.5) {
        const side = momentum > 0 ? 'LONG' : 'SHORT';
        // Rookie sometimes picks the wrong side
        const actualSide = Math.random() > 0.3 ? side : (side === 'LONG' ? 'SHORT' : 'LONG');
        engine.processOrder(houseBotId, {
          symbol, side: actualSide as 'LONG' | 'SHORT', action: 'OPEN', quantity: sizePct,
        });
      }
    } else if (difficulty === 'VETERAN') {
      // Veteran: mean reversion with decent timing
      const std = Math.sqrt(history.reduce((s, p) => s + (p - mean) ** 2, 0) / history.length);
      if (std === 0) return;
      const zScore = (price - mean) / std;

      if (zScore < -1.0) {
        engine.processOrder(houseBotId, { symbol, side: 'LONG', action: 'OPEN', quantity: sizePct });
      } else if (zScore > 1.0) {
        engine.processOrder(houseBotId, { symbol, side: 'SHORT', action: 'OPEN', quantity: sizePct });
      }
    } else {
      // Elite: aggressive momentum + mean reversion hybrid
      const std = Math.sqrt(history.reduce((s, p) => s + (p - mean) ** 2, 0) / history.length);
      if (std === 0) return;
      const zScore = (price - mean) / std;

      if (momentum > 0.1 && zScore < 0.5) {
        engine.processOrder(houseBotId, { symbol, side: 'LONG', action: 'OPEN', quantity: sizePct });
      } else if (momentum < -0.1 && zScore > -0.5) {
        engine.processOrder(houseBotId, { symbol, side: 'SHORT', action: 'OPEN', quantity: sizePct });
      } else if (zScore < -1.5) {
        engine.processOrder(houseBotId, { symbol, side: 'LONG', action: 'OPEN', quantity: sizePct * 1.5 });
      } else if (zScore > 1.5) {
        engine.processOrder(houseBotId, { symbol, side: 'SHORT', action: 'OPEN', quantity: sizePct * 1.5 });
      }
    }
  }

  /**
   * Clear price history for a match that ended
   */
  clearHistory(houseBotId: string): void {
    for (const key of this.priceHistory.keys()) {
      if (key.startsWith(houseBotId)) {
        this.priceHistory.delete(key);
      }
    }
  }
}

export const houseBotService = new HouseBotService();
