import prisma from '../lib/prisma';

/**
 * Achievement Service — 50+ achievements across categories:
 * - Milestones: first win, 10 wins, 100 wins, 1000 wins
 * - Streaks: 7-day, 30-day, 100-day, 365-day
 * - Skill: beat Platinum from Silver, score 800+, profit factor 3+
 * - Special: trade during flash crash, win in under 60s
 * - Social: join clan, follow 10 people, get 100 followers
 */

interface AchievementDef {
  key: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
}

const ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  // === MILESTONES ===
  { key: 'first_blood', name: 'First Blood', description: 'Win your first match', category: 'MILESTONES', rarity: 'COMMON' },
  { key: 'getting_started', name: 'Getting Started', description: 'Complete 5 matches', category: 'MILESTONES', rarity: 'COMMON' },
  { key: 'warrior', name: 'Warrior', description: 'Win 10 matches', category: 'MILESTONES', rarity: 'COMMON' },
  { key: 'veteran', name: 'Veteran', description: 'Win 50 matches', category: 'MILESTONES', rarity: 'UNCOMMON' },
  { key: 'centurion', name: 'Centurion', description: 'Win 100 matches', category: 'MILESTONES', rarity: 'RARE' },
  { key: 'legend', name: 'Legend', description: 'Win 500 matches', category: 'MILESTONES', rarity: 'EPIC' },
  { key: 'thousand_wins', name: 'The Thousand', description: 'Win 1,000 matches', category: 'MILESTONES', rarity: 'LEGENDARY' },
  { key: 'bot_builder', name: 'Bot Builder', description: 'Create your first bot', category: 'MILESTONES', rarity: 'COMMON' },
  { key: 'fleet_commander', name: 'Fleet Commander', description: 'Create 5 bots', category: 'MILESTONES', rarity: 'UNCOMMON' },

  // === STREAKS ===
  { key: 'streak_7', name: 'On Fire', description: 'Maintain a 7-day streak', category: 'STREAKS', rarity: 'COMMON' },
  { key: 'streak_30', name: 'Dedicated', description: 'Maintain a 30-day streak', category: 'STREAKS', rarity: 'RARE' },
  { key: 'streak_100', name: 'Unstoppable', description: 'Maintain a 100-day streak', category: 'STREAKS', rarity: 'EPIC' },
  { key: 'streak_365', name: 'Year of the Bot', description: 'Maintain a 365-day streak', category: 'STREAKS', rarity: 'LEGENDARY' },
  { key: 'win_streak_3', name: 'Hat Trick', description: 'Win 3 matches in a row', category: 'STREAKS', rarity: 'COMMON' },
  { key: 'win_streak_5', name: 'Pentakill', description: 'Win 5 matches in a row', category: 'STREAKS', rarity: 'UNCOMMON' },
  { key: 'win_streak_10', name: 'Domination', description: 'Win 10 matches in a row', category: 'STREAKS', rarity: 'RARE' },
  { key: 'win_streak_20', name: 'Unstoppable Force', description: 'Win 20 matches in a row', category: 'STREAKS', rarity: 'EPIC' },

  // === SKILL ===
  { key: 'score_500', name: 'Solid Performance', description: 'Score 500+ in a single match', category: 'SKILL', rarity: 'COMMON' },
  { key: 'score_700', name: 'Elite Trader', description: 'Score 700+ in a single match', category: 'SKILL', rarity: 'UNCOMMON' },
  { key: 'score_800', name: 'Master Class', description: 'Score 800+ in a single match', category: 'SKILL', rarity: 'RARE' },
  { key: 'score_900', name: 'Perfection', description: 'Score 900+ in a single match', category: 'SKILL', rarity: 'EPIC' },
  { key: 'score_950', name: 'Almost Perfect', description: 'Score 950+ in a single match', category: 'SKILL', rarity: 'LEGENDARY' },
  { key: 'profit_factor_2', name: 'Efficient', description: 'Achieve a profit factor above 2.0', category: 'SKILL', rarity: 'UNCOMMON' },
  { key: 'profit_factor_3', name: 'Precision Machine', description: 'Achieve a profit factor above 3.0', category: 'SKILL', rarity: 'RARE' },
  { key: 'sharpe_2', name: 'Risk Manager', description: 'Achieve a Sharpe ratio above 2.0', category: 'SKILL', rarity: 'RARE' },
  { key: 'zero_drawdown', name: 'Flawless', description: 'Win with 0% max drawdown', category: 'SKILL', rarity: 'EPIC' },
  { key: 'underdog', name: 'Giant Slayer', description: 'Beat a bot 300+ ELO above you', category: 'SKILL', rarity: 'RARE' },
  { key: 'comeback', name: 'Comeback Kid', description: 'Win after being behind by 100+ points mid-match', category: 'SKILL', rarity: 'RARE' },

  // === TIERS ===
  { key: 'reach_silver', name: 'Silver Lining', description: 'Reach Silver tier', category: 'TIERS', rarity: 'COMMON' },
  { key: 'reach_gold', name: 'Golden Age', description: 'Reach Gold tier', category: 'TIERS', rarity: 'UNCOMMON' },
  { key: 'reach_platinum', name: 'Platinum Standard', description: 'Reach Platinum tier', category: 'TIERS', rarity: 'RARE' },
  { key: 'reach_diamond', name: 'Diamond Hands', description: 'Reach Diamond tier', category: 'TIERS', rarity: 'EPIC' },

  // === TRADING ===
  { key: 'first_trade', name: 'Market Entry', description: 'Execute your first trade', category: 'TRADING', rarity: 'COMMON' },
  { key: 'trades_100', name: 'Active Trader', description: 'Execute 100 trades', category: 'TRADING', rarity: 'COMMON' },
  { key: 'trades_1000', name: 'High Frequency', description: 'Execute 1,000 trades', category: 'TRADING', rarity: 'UNCOMMON' },
  { key: 'trades_10000', name: 'Market Maker', description: 'Execute 10,000 trades', category: 'TRADING', rarity: 'RARE' },
  { key: 'all_symbols', name: 'Diversified', description: 'Trade all available symbols in one match', category: 'TRADING', rarity: 'UNCOMMON' },
  { key: 'only_longs', name: 'Perma Bull', description: 'Win a match with only LONG positions', category: 'TRADING', rarity: 'UNCOMMON' },
  { key: 'only_shorts', name: 'Perma Bear', description: 'Win a match with only SHORT positions', category: 'TRADING', rarity: 'UNCOMMON' },

  // === SOCIAL ===
  { key: 'join_clan', name: 'Team Player', description: 'Join a clan', category: 'SOCIAL', rarity: 'COMMON' },
  { key: 'create_clan', name: 'Leader', description: 'Create a clan', category: 'SOCIAL', rarity: 'UNCOMMON' },
  { key: 'follow_10', name: 'Networker', description: 'Follow 10 traders', category: 'SOCIAL', rarity: 'COMMON' },
  { key: 'followers_10', name: 'Rising Star', description: 'Get 10 followers', category: 'SOCIAL', rarity: 'UNCOMMON' },
  { key: 'followers_100', name: 'Influencer', description: 'Get 100 followers', category: 'SOCIAL', rarity: 'RARE' },
  { key: 'followers_1000', name: 'Celebrity', description: 'Get 1,000 followers', category: 'SOCIAL', rarity: 'EPIC' },

  // === SPECIAL ===
  { key: 'night_owl', name: 'Night Owl', description: 'Win a match between midnight and 4 AM', category: 'SPECIAL', rarity: 'UNCOMMON' },
  { key: 'speed_demon', name: 'Speed Demon', description: 'Score 500+ with 20+ trades', category: 'SPECIAL', rarity: 'UNCOMMON' },
  { key: 'first_tournament', name: 'Contender', description: 'Enter your first tournament', category: 'SPECIAL', rarity: 'COMMON' },
  { key: 'tournament_winner', name: 'Champion', description: 'Win a tournament', category: 'SPECIAL', rarity: 'RARE' },
  { key: 'challenge_clear', name: 'Challenger', description: 'Complete your first challenge', category: 'SPECIAL', rarity: 'COMMON' },
  { key: 'daily_quest_all', name: 'Quest Complete', description: 'Complete all 3 daily quests in one day', category: 'SPECIAL', rarity: 'COMMON' },
  { key: 'season_pass_50', name: 'Season Master', description: 'Reach level 50 in the season pass', category: 'SPECIAL', rarity: 'LEGENDARY' },
];

export class AchievementService {
  /**
   * Seed all achievements into the database
   */
  async seedAchievements(): Promise<number> {
    let created = 0;
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      const existing = await prisma.achievement.findUnique({ where: { key: def.key } });
      if (!existing) {
        await prisma.achievement.create({
          data: {
            key: def.key,
            name: def.name,
            description: def.description,
            category: def.category,
            rarity: def.rarity,
          },
        });
        created++;
      }
    }
    return created;
  }

  /**
   * Check and award achievements based on event
   * Returns list of newly unlocked achievements
   */
  async checkAndAward(
    userId: string,
    context: {
      type: 'match_end' | 'streak' | 'social' | 'trade' | 'tier_change' | 'quest' | 'tournament';
      data: any;
    },
  ): Promise<{ key: string; name: string; rarity: string }[]> {
    const unlocked: { key: string; name: string; rarity: string }[] = [];

    const checks = this.getChecksForType(context.type, context.data);

    for (const check of checks) {
      const alreadyHas = await prisma.userAchievement.findFirst({
        where: { userId, achievement: { key: check.key } },
      });
      if (alreadyHas) continue;

      const achievement = await prisma.achievement.findUnique({ where: { key: check.key } });
      if (!achievement) continue;

      if (check.condition()) {
        await prisma.userAchievement.create({
          data: { userId, achievementId: achievement.id },
        });
        unlocked.push({ key: achievement.key, name: achievement.name, rarity: achievement.rarity });

        // Create notification
        await prisma.notification.create({
          data: {
            userId,
            type: 'ACHIEVEMENT',
            title: `Achievement Unlocked: ${achievement.name}`,
            message: achievement.description,
            data: JSON.stringify({ key: achievement.key, rarity: achievement.rarity }),
          },
        });
      }
    }

    return unlocked;
  }

  private getChecksForType(type: string, data: any): { key: string; condition: () => boolean }[] {
    const checks: { key: string; condition: () => boolean }[] = [];

    if (type === 'match_end') {
      const { isWin, totalWins, score, winStreak, eloGap, totalMatches } = data;
      if (isWin && totalWins === 1) checks.push({ key: 'first_blood', condition: () => true });
      if (totalMatches === 5) checks.push({ key: 'getting_started', condition: () => true });
      if (isWin && totalWins === 10) checks.push({ key: 'warrior', condition: () => true });
      if (isWin && totalWins === 50) checks.push({ key: 'veteran', condition: () => true });
      if (isWin && totalWins === 100) checks.push({ key: 'centurion', condition: () => true });
      if (isWin && totalWins === 500) checks.push({ key: 'legend', condition: () => true });
      if (isWin && totalWins === 1000) checks.push({ key: 'thousand_wins', condition: () => true });
      if (score >= 500) checks.push({ key: 'score_500', condition: () => true });
      if (score >= 700) checks.push({ key: 'score_700', condition: () => true });
      if (score >= 800) checks.push({ key: 'score_800', condition: () => true });
      if (score >= 900) checks.push({ key: 'score_900', condition: () => true });
      if (score >= 950) checks.push({ key: 'score_950', condition: () => true });
      if (winStreak >= 3) checks.push({ key: 'win_streak_3', condition: () => true });
      if (winStreak >= 5) checks.push({ key: 'win_streak_5', condition: () => true });
      if (winStreak >= 10) checks.push({ key: 'win_streak_10', condition: () => true });
      if (winStreak >= 20) checks.push({ key: 'win_streak_20', condition: () => true });
      if (isWin && eloGap >= 300) checks.push({ key: 'underdog', condition: () => true });
    }

    if (type === 'streak') {
      const { currentStreak } = data;
      if (currentStreak >= 7) checks.push({ key: 'streak_7', condition: () => true });
      if (currentStreak >= 30) checks.push({ key: 'streak_30', condition: () => true });
      if (currentStreak >= 100) checks.push({ key: 'streak_100', condition: () => true });
      if (currentStreak >= 365) checks.push({ key: 'streak_365', condition: () => true });
    }

    if (type === 'tier_change') {
      const { newTier } = data;
      if (newTier === 'SILVER') checks.push({ key: 'reach_silver', condition: () => true });
      if (newTier === 'GOLD') checks.push({ key: 'reach_gold', condition: () => true });
      if (newTier === 'PLATINUM') checks.push({ key: 'reach_platinum', condition: () => true });
      if (newTier === 'DIAMOND') checks.push({ key: 'reach_diamond', condition: () => true });
    }

    if (type === 'social') {
      const { followingCount, followerCount, joinedClan, createdClan } = data;
      if (followingCount >= 10) checks.push({ key: 'follow_10', condition: () => true });
      if (followerCount >= 10) checks.push({ key: 'followers_10', condition: () => true });
      if (followerCount >= 100) checks.push({ key: 'followers_100', condition: () => true });
      if (followerCount >= 1000) checks.push({ key: 'followers_1000', condition: () => true });
      if (joinedClan) checks.push({ key: 'join_clan', condition: () => true });
      if (createdClan) checks.push({ key: 'create_clan', condition: () => true });
    }

    if (type === 'quest') {
      const { allCompleted } = data;
      if (allCompleted) checks.push({ key: 'daily_quest_all', condition: () => true });
    }

    if (type === 'tournament') {
      const { isFirst, isWinner } = data;
      if (isFirst) checks.push({ key: 'first_tournament', condition: () => true });
      if (isWinner) checks.push({ key: 'tournament_winner', condition: () => true });
    }

    return checks;
  }

  /**
   * Get all achievements with unlock status for a user
   */
  async getUserAchievements(userId: string) {
    const achievements = await prisma.achievement.findMany({
      include: {
        users: {
          where: { userId },
        },
      },
      orderBy: [{ category: 'asc' }, { rarity: 'asc' }],
    });

    return achievements.map(a => ({
      ...a,
      unlocked: a.users.length > 0,
      unlockedAt: a.users[0]?.unlockedAt,
    }));
  }
}

export const achievementService = new AchievementService();
