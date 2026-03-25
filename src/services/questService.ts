import prisma from '../lib/prisma';

/**
 * Daily Quest Service — 3 quests per day, refresh at midnight UTC
 *
 * Quest types:
 * - WIN_MATCH: Win a match
 * - PROFITABLE_TRADES: Close N profitable trades
 * - NEW_SYMBOL: Trade a symbol you haven't traded before
 * - BEAT_PB: Beat your personal best score
 * - WATCH_MATCH: Watch a featured match
 */

interface QuestTemplate {
  questType: string;
  description: string;
  target: number;
  reward: number;
}

const QUEST_POOL: QuestTemplate[] = [
  { questType: 'WIN_MATCH', description: 'Win a match', target: 1, reward: 50 },
  { questType: 'PROFITABLE_TRADES', description: 'Close 10 profitable trades across matches', target: 10, reward: 30 },
  { questType: 'NEW_SYMBOL', description: 'Trade a symbol you haven\'t traded before', target: 1, reward: 20 },
  { questType: 'BEAT_PB', description: 'Beat your personal best score', target: 1, reward: 40 },
  { questType: 'WATCH_MATCH', description: 'Watch a featured match', target: 1, reward: 15 },
  { questType: 'WIN_MATCH', description: 'Win 3 matches', target: 3, reward: 75 },
  { questType: 'PROFITABLE_TRADES', description: 'Close 5 profitable trades', target: 5, reward: 25 },
];

const ALL_THREE_BONUS = 50;
const QUEST_XP = 50;

export class QuestService {
  /**
   * Get or generate today's quests for a user
   */
  async getQuests(userId: string) {
    const today = todayStr();
    let quests = await prisma.dailyQuest.findMany({
      where: { userId, date: today },
    });

    if (quests.length === 0) {
      quests = await this.generateQuests(userId, today);
    }

    const allCompleted = quests.every(q => q.completed);
    return { quests, allCompleted, bonusEarned: allCompleted };
  }

  /**
   * Generate 3 random quests for today
   */
  private async generateQuests(userId: string, date: string) {
    // Pick 3 unique quest types
    const shuffled = [...QUEST_POOL].sort(() => Math.random() - 0.5);
    const usedTypes = new Set<string>();
    const selected: QuestTemplate[] = [];

    for (const q of shuffled) {
      if (!usedTypes.has(q.questType) && selected.length < 3) {
        selected.push(q);
        usedTypes.add(q.questType);
      }
    }

    const quests = await Promise.all(
      selected.map(q =>
        prisma.dailyQuest.create({
          data: {
            userId,
            date,
            questType: q.questType,
            description: q.description,
            target: q.target,
            reward: q.reward,
          },
        })
      )
    );

    return quests;
  }

  /**
   * Update quest progress. Call after relevant events.
   * Returns any newly completed quests and whether bonus was earned.
   */
  async updateProgress(
    userId: string,
    questType: string,
    increment: number = 1,
  ): Promise<{ completed: string[]; bonusEarned: boolean }> {
    const today = todayStr();
    const quests = await prisma.dailyQuest.findMany({
      where: { userId, date: today, questType, completed: false },
    });

    const completed: string[] = [];

    for (const quest of quests) {
      const newProgress = Math.min(quest.progress + increment, quest.target);
      const isCompleted = newProgress >= quest.target;

      await prisma.dailyQuest.update({
        where: { id: quest.id },
        data: {
          progress: newProgress,
          completed: isCompleted,
        },
      });

      if (isCompleted) {
        completed.push(quest.id);
        // Award credits
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: quest.reward } },
        });
      }
    }

    // Check if all 3 completed for bonus
    let bonusEarned = false;
    if (completed.length > 0) {
      const allQuests = await prisma.dailyQuest.findMany({
        where: { userId, date: today },
      });
      if (allQuests.length >= 3 && allQuests.every(q => q.completed)) {
        bonusEarned = true;
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: ALL_THREE_BONUS } },
        });
      }
    }

    return { completed, bonusEarned };
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const questService = new QuestService();
