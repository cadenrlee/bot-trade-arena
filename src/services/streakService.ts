import prisma from '../lib/prisma';

/**
 * Streak Service — Duolingo-style consecutive day tracking
 *
 * - Track consecutive days with activity
 * - Streak freeze (Pro: 1 free/week, Competitor: buy with credits)
 * - Streak restore within 24h for 500 credits
 * - Streak milestones: 7, 30, 100, 365 → badges + cosmetics
 */

const STREAK_MILESTONES = [7, 30, 100, 365];
const STREAK_RESTORE_COST = 500;

export class StreakService {
  /**
   * Record activity for a user — call after every match, challenge, etc.
   * Returns updated streak info.
   */
  async recordActivity(userId: string): Promise<{
    currentStreak: number;
    milestoneReached?: number;
    isNewDay: boolean;
  }> {
    const now = new Date();
    const todayStr = toDateStr(now);

    let streak = await prisma.userStreak.findUnique({ where: { userId } });

    if (!streak) {
      streak = await prisma.userStreak.create({
        data: { userId, currentStreak: 1, longestStreak: 1, lastActivityAt: now },
      });
      return { currentStreak: 1, isNewDay: true };
    }

    const lastDate = streak.lastActivityAt ? toDateStr(streak.lastActivityAt) : null;

    // Already active today
    if (lastDate === todayStr) {
      return { currentStreak: streak.currentStreak, isNewDay: false };
    }

    const yesterdayStr = toDateStr(new Date(now.getTime() - 86400000));
    let newStreak: number;

    if (lastDate === yesterdayStr) {
      // Consecutive day
      newStreak = streak.currentStreak + 1;
    } else if (streak.streakRestorable && lastDate === toDateStr(new Date(now.getTime() - 86400000 * 2))) {
      // Used a freeze yesterday, still counts
      newStreak = streak.currentStreak + 1;
    } else {
      // Streak broken
      newStreak = 1;
    }

    const longestStreak = Math.max(streak.longestStreak, newStreak);

    await prisma.userStreak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak,
        lastActivityAt: now,
        streakRestorable: false,
      },
    });

    // Update user lastActiveAt
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: now },
    });

    // Check for milestone
    const milestoneReached = STREAK_MILESTONES.find(m => newStreak === m);

    return { currentStreak: newStreak, milestoneReached, isNewDay: true };
  }

  /**
   * Use a streak freeze (prevents streak break for missing a day)
   */
  async useFreeze(userId: string): Promise<boolean> {
    const streak = await prisma.userStreak.findUnique({ where: { userId } });
    if (!streak || streak.freezesAvailable <= 0) return false;

    await prisma.userStreak.update({
      where: { userId },
      data: {
        freezesAvailable: { decrement: 1 },
        freezesUsed: { increment: 1 },
        streakRestorable: true,
      },
    });

    return true;
  }

  /**
   * Restore a broken streak (within 24h, costs credits)
   */
  async restoreStreak(userId: string): Promise<{ success: boolean; error?: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: 'User not found' };
    if (user.credits < STREAK_RESTORE_COST) {
      return { success: false, error: `Need ${STREAK_RESTORE_COST} credits (have ${user.credits})` };
    }

    const streak = await prisma.userStreak.findUnique({ where: { userId } });
    if (!streak) return { success: false, error: 'No streak to restore' };

    const now = new Date();
    const lastActivity = streak.lastActivityAt;
    if (!lastActivity) return { success: false, error: 'No previous activity' };

    const hoursSince = (now.getTime() - lastActivity.getTime()) / 3600000;
    if (hoursSince > 48) {
      return { success: false, error: 'Restore window expired (24h after break)' };
    }

    // Deduct credits and restore
    await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: STREAK_RESTORE_COST } },
    });

    await prisma.userStreak.update({
      where: { userId },
      data: { lastActivityAt: now },
    });

    return { success: true };
  }

  /**
   * Grant weekly freeze to Pro subscribers
   */
  async grantWeeklyFreezes(): Promise<void> {
    const proUsers = await prisma.user.findMany({
      where: { plan: 'PRO' },
      select: { id: true },
    });

    for (const user of proUsers) {
      await prisma.userStreak.upsert({
        where: { userId: user.id },
        create: { userId: user.id, freezesAvailable: 1 },
        update: { freezesAvailable: 1 },
      });
    }
  }

  /**
   * Get streak info for a user
   */
  async getStreak(userId: string) {
    const streak = await prisma.userStreak.findUnique({ where: { userId } });
    if (!streak) {
      return { currentStreak: 0, longestStreak: 0, freezesAvailable: 0, isAtRisk: false };
    }

    const now = new Date();
    const lastDate = streak.lastActivityAt ? toDateStr(streak.lastActivityAt) : null;
    const todayStr = toDateStr(now);
    const isActiveToday = lastDate === todayStr;

    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      freezesAvailable: streak.freezesAvailable,
      isActiveToday,
      isAtRisk: !isActiveToday && streak.currentStreak > 0,
      nextMilestone: STREAK_MILESTONES.find(m => m > streak.currentStreak),
    };
  }
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const streakService = new StreakService();
