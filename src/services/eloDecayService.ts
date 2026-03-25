import prisma from '../lib/prisma';
import { eloToTier } from '../engine/scoring';

/**
 * ELO Decay Service
 *
 * After 3 days of inactivity, ELO decays by 5 points/day.
 * Playing 1 match stops decay.
 * Sends notification at day 3.
 */

const DECAY_THRESHOLD_DAYS = 3;
const DECAY_PER_DAY = 5;
const MIN_ELO = 800; // ELO can't decay below this

export class EloDecayService {
  /**
   * Run decay check for all users — call daily via cron
   */
  async runDecay(): Promise<{ decayed: number; warned: number }> {
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - DECAY_THRESHOLD_DAYS * 86400000);

    // Find users who haven't been active
    const inactiveUsers = await prisma.user.findMany({
      where: {
        lastActiveAt: { lt: thresholdDate },
        elo: { gt: MIN_ELO },
      },
      select: { id: true, elo: true, lastActiveAt: true, username: true },
    });

    let decayed = 0;
    let warned = 0;

    for (const user of inactiveUsers) {
      if (!user.lastActiveAt) continue;

      const daysSinceActive = Math.floor((now.getTime() - user.lastActiveAt.getTime()) / 86400000);

      if (daysSinceActive === DECAY_THRESHOLD_DAYS) {
        // Send warning notification
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: 'DECAY_WARNING',
            title: 'Your ELO is decaying!',
            message: `Your ranking is decaying. Play a match to maintain your position.`,
          },
        });
        warned++;
      }

      if (daysSinceActive >= DECAY_THRESHOLD_DAYS) {
        const daysDecaying = daysSinceActive - DECAY_THRESHOLD_DAYS + 1;
        const newElo = Math.max(MIN_ELO, user.elo - DECAY_PER_DAY);
        const decayAmount = user.elo - newElo;

        if (decayAmount > 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              elo: newElo,
              tier: eloToTier(newElo),
            },
          });

          // Track decay
          await prisma.eloDecay.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              lastMatchAt: user.lastActiveAt,
              decayStartedAt: new Date(user.lastActiveAt.getTime() + DECAY_THRESHOLD_DAYS * 86400000),
              totalDecayed: decayAmount,
              isDecaying: true,
            },
            update: {
              totalDecayed: { increment: decayAmount },
              isDecaying: true,
            },
          });

          decayed++;
        }
      }
    }

    return { decayed, warned };
  }

  /**
   * Stop decay for a user (called when they play a match)
   */
  async stopDecay(userId: string): Promise<void> {
    await prisma.eloDecay.updateMany({
      where: { userId, isDecaying: true },
      data: { isDecaying: false },
    });
  }

  /**
   * Get decay status for a user
   */
  async getDecayStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastActiveAt: true, elo: true },
    });
    if (!user?.lastActiveAt) return { isDecaying: false, daysSinceActive: 0, decayPerDay: 0 };

    const daysSinceActive = Math.floor((Date.now() - user.lastActiveAt.getTime()) / 86400000);
    const isDecaying = daysSinceActive >= DECAY_THRESHOLD_DAYS;

    return {
      isDecaying,
      daysSinceActive,
      decayPerDay: isDecaying ? DECAY_PER_DAY : 0,
      daysUntilDecay: Math.max(0, DECAY_THRESHOLD_DAYS - daysSinceActive),
    };
  }
}

export const eloDecayService = new EloDecayService();
