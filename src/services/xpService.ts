import prisma from '../lib/prisma';

/**
 * XP & Level Service
 *
 * XP sources:
 * - Complete a match: 100 XP
 * - Win a match: +50 XP bonus
 * - Daily quest: 50 XP each
 * - Weekly challenge: 200 XP
 * - Tournament placement: 100-500 XP
 * - Challenge completion: 75 XP
 * - Spectating: 10 XP
 *
 * Leveling: Each level requires progressively more XP.
 * Level N requires N * 100 XP (so level 10 requires 1000 XP cumulative).
 */

const XP_VALUES: Record<string, number> = {
  MATCH: 100,
  WIN: 50,
  QUEST: 50,
  WEEKLY: 200,
  TOURNAMENT: 100, // base, multiply by placement
  CHALLENGE: 75,
  SPECTATE: 10,
};

function xpForLevel(level: number): number {
  return level * 100;
}

function levelFromXp(totalXp: number): number {
  let level = 1;
  let xpNeeded = 0;
  while (true) {
    xpNeeded += xpForLevel(level);
    if (totalXp < xpNeeded) return level;
    level++;
    if (level > 999) return 999;
  }
}

export class XpService {
  /**
   * Award XP to a user
   */
  async awardXp(
    userId: string,
    source: string,
    description: string,
    sourceId?: string,
    multiplier: number = 1,
  ): Promise<{
    xpGained: number;
    totalXp: number;
    newLevel: number;
    leveledUp: boolean;
  }> {
    const baseXp = XP_VALUES[source] || 0;
    const xpGained = Math.round(baseXp * multiplier);

    // Record XP event
    await prisma.xpEvent.create({
      data: { userId, amount: xpGained, source, sourceId, description },
    });

    // Update user XP
    const userXp = await prisma.userXp.upsert({
      where: { userId },
      create: { userId, totalXp: xpGained, seasonXp: xpGained },
      update: {
        totalXp: { increment: xpGained },
        seasonXp: { increment: xpGained },
      },
    });

    const newLevel = levelFromXp(userXp.totalXp);
    const leveledUp = newLevel > userXp.level;

    if (leveledUp) {
      await prisma.userXp.update({
        where: { userId },
        data: { level: newLevel },
      });
    }

    // Also update the User model for quick access
    await prisma.user.update({
      where: { id: userId },
      data: {
        xp: userXp.totalXp,
        level: newLevel,
      },
    });

    // Update season pass progress
    await this.updateSeasonPass(userId, xpGained);

    return { xpGained, totalXp: userXp.totalXp, newLevel, leveledUp };
  }

  /**
   * Get XP info for a user
   */
  async getXpInfo(userId: string) {
    const userXp = await prisma.userXp.findUnique({ where: { userId } });
    if (!userXp) {
      return {
        totalXp: 0,
        seasonXp: 0,
        level: 1,
        seasonLevel: 1,
        xpToNextLevel: xpForLevel(1),
        xpInCurrentLevel: 0,
      };
    }

    const nextLevel = userXp.level + 1;
    let cumXpForCurrent = 0;
    for (let i = 1; i < userXp.level; i++) cumXpForCurrent += xpForLevel(i);
    const xpInCurrentLevel = userXp.totalXp - cumXpForCurrent;

    return {
      totalXp: userXp.totalXp,
      seasonXp: userXp.seasonXp,
      level: userXp.level,
      seasonLevel: userXp.seasonLevel,
      xpToNextLevel: xpForLevel(nextLevel),
      xpInCurrentLevel,
    };
  }

  /**
   * Update season pass progress with new XP
   */
  private async updateSeasonPass(userId: string, xpGained: number): Promise<void> {
    const season = await prisma.season.findFirst({ where: { isActive: true } });
    if (!season) return;

    const pass = await prisma.seasonPass.findUnique({
      where: { userId_seasonId: { userId, seasonId: season.id } },
    });

    if (!pass) {
      await prisma.seasonPass.create({
        data: { userId, seasonId: season.id, xpInLevel: xpGained },
      });
      return;
    }

    let xpInLevel = pass.xpInLevel + xpGained;
    let currentLevel = pass.currentLevel;
    const maxLevel = 50;

    // Level up in season pass
    while (currentLevel < maxLevel) {
      const xpNeeded = currentLevel * 200; // 200 XP per level in season pass
      if (xpInLevel >= xpNeeded) {
        xpInLevel -= xpNeeded;
        currentLevel++;
      } else {
        break;
      }
    }

    await prisma.seasonPass.update({
      where: { id: pass.id },
      data: { currentLevel, xpInLevel },
    });
  }
}

export const xpService = new XpService();
