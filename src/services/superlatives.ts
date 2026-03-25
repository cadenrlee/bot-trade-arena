import prisma from '../lib/prisma';

/**
 * Superlatives — What each bot is best at.
 *
 * Computed from match history:
 *   - Profit Machine: Highest average P&L
 *   - Risk Manager: Lowest average max drawdown
 *   - Sharpshooter: Highest average Sharpe ratio
 *   - Win Streak King: Longest win streak
 *   - Consistent: Smallest score variance
 *   - Clutch Player: Best score in close matches (margin < 50)
 *   - Volume Trader: Most trades per match
 *   - Sniper: Highest win rate with 10+ matches
 *   - Comeback Kid: Most wins from behind
 *   - Iron Will: Most matches played
 */

export interface Superlative {
  title: string;
  description: string;
  icon: string;
  value: string;
}

export class SuperlativesService {
  /**
   * Get superlatives for a specific bot
   */
  async getBotSuperlatives(botId: string): Promise<Superlative[]> {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return [];

    const superlatives: Superlative[] = [];

    // Get matches where this bot participated
    const matches = await prisma.match.findMany({
      where: {
        status: 'COMPLETED',
        OR: [{ bot1Id: botId }, { bot2Id: botId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (matches.length === 0) return [];

    // Calculate stats
    let totalPnl = 0, totalScore = 0, totalWinRate = 0, totalSharpe = 0, totalMaxDd = 0, totalTrades = 0;
    let scores: number[] = [];
    let wins = 0, closeWins = 0;

    for (const m of matches) {
      const isBot1 = m.bot1Id === botId;
      const score = isBot1 ? (m.bot1Score || 0) : (m.bot2Score || 0);
      const pnl = isBot1 ? (m.bot1Pnl || 0) : (m.bot2Pnl || 0);
      const winRate = isBot1 ? (m.bot1WinRate || 0) : (m.bot2WinRate || 0);
      const sharpe = isBot1 ? (m.bot1Sharpe || 0) : (m.bot2Sharpe || 0);
      const maxDd = isBot1 ? (m.bot1MaxDd || 0) : (m.bot2MaxDd || 0);
      const trades = isBot1 ? (m.bot1Trades || 0) : (m.bot2Trades || 0);
      const isWinner = m.winnerId === (isBot1 ? m.bot1Id : m.bot2Id) ||
        (isBot1 && m.winnerId && score > ((m.bot2Score || 0)));

      totalPnl += pnl;
      totalScore += score;
      totalWinRate += winRate;
      totalSharpe += sharpe;
      totalMaxDd += maxDd;
      totalTrades += trades;
      scores.push(score);

      if (isWinner) wins++;
      if (isWinner && Math.abs((m.bot1Score || 0) - (m.bot2Score || 0)) < 50) closeWins++;
    }

    const n = matches.length;
    const avgPnl = totalPnl / n;
    const avgScore = totalScore / n;
    const avgWinRate = totalWinRate / n;
    const avgSharpe = totalSharpe / n;
    const avgMaxDd = totalMaxDd / n;
    const avgTrades = totalTrades / n;
    const overallWinRate = (wins / n) * 100;

    // Score variance
    const scoreMean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const scoreVariance = scores.reduce((s, v) => s + (v - scoreMean) ** 2, 0) / scores.length;
    const scoreStdDev = Math.sqrt(scoreVariance);

    // Assign superlatives based on strengths
    if (avgPnl > 50) superlatives.push({ title: 'Profit Machine', description: 'Consistently profitable', icon: '$', value: `+$${avgPnl.toFixed(0)}/match` });
    if (avgMaxDd < 3) superlatives.push({ title: 'Risk Manager', description: 'Keeps drawdowns tiny', icon: '!', value: `${avgMaxDd.toFixed(1)}% avg DD` });
    if (avgSharpe > 1.5) superlatives.push({ title: 'Sharp Edge', description: 'Exceptional risk-adjusted returns', icon: '/', value: `${avgSharpe.toFixed(2)} Sharpe` });
    if (bot.bestWinStreak >= 5) superlatives.push({ title: 'Streak King', description: 'Dominant winning streaks', icon: '*', value: `${bot.bestWinStreak} streak` });
    if (scoreStdDev < 50 && n >= 5) superlatives.push({ title: 'Consistent', description: 'Reliable performance every match', icon: '=', value: `${scoreStdDev.toFixed(0)} std dev` });
    if (closeWins >= 3) superlatives.push({ title: 'Clutch Player', description: 'Wins the close ones', icon: '!', value: `${closeWins} close wins` });
    if (avgTrades > 15) superlatives.push({ title: 'Volume Trader', description: 'High-frequency approach', icon: '>', value: `${avgTrades.toFixed(0)} trades/match` });
    if (overallWinRate > 60 && n >= 10) superlatives.push({ title: 'Sharpshooter', description: 'High win rate under pressure', icon: '+', value: `${overallWinRate.toFixed(0)}% win rate` });
    if (n >= 50) superlatives.push({ title: 'Iron Will', description: 'Battle-tested veteran', icon: '#', value: `${n} matches` });
    if (avgScore > 600) superlatives.push({ title: 'Elite Scorer', description: 'Top-tier composite scores', icon: '^', value: `${avgScore.toFixed(0)} avg` });

    return superlatives;
  }

  /**
   * Get global superlative rankings — who's the best at what
   */
  async getGlobalSuperlatives(): Promise<Record<string, { username: string; botName: string; value: string }>> {
    const bots = await prisma.bot.findMany({
      where: { totalMatches: { gte: 5 } },
      include: { user: { select: { username: true } } },
      orderBy: { totalMatches: 'desc' },
      take: 50,
    });

    const results: Record<string, { username: string; botName: string; value: string }> = {};

    let bestWinRate = { rate: 0, username: '', botName: '' };
    let bestElo = { elo: 0, username: '', botName: '' };
    let bestStreak = { streak: 0, username: '', botName: '' };
    let mostMatches = { count: 0, username: '', botName: '' };
    let bestScore = { score: 0, username: '', botName: '' };

    for (const bot of bots) {
      const winRate = bot.totalMatches > 0 ? (bot.totalWins / bot.totalMatches) * 100 : 0;

      if (winRate > bestWinRate.rate) bestWinRate = { rate: winRate, username: bot.user.username, botName: bot.name };
      if (bot.elo > bestElo.elo) bestElo = { elo: bot.elo, username: bot.user.username, botName: bot.name };
      if (bot.bestWinStreak > bestStreak.streak) bestStreak = { streak: bot.bestWinStreak, username: bot.user.username, botName: bot.name };
      if (bot.totalMatches > mostMatches.count) mostMatches = { count: bot.totalMatches, username: bot.user.username, botName: bot.name };
      if (bot.bestScore > bestScore.score) bestScore = { score: bot.bestScore, username: bot.user.username, botName: bot.name };
    }

    if (bestWinRate.rate > 0) results['Highest Win Rate'] = { ...bestWinRate, value: `${bestWinRate.rate.toFixed(1)}%` };
    if (bestElo.elo > 0) results['Top Rated'] = { ...bestElo, value: `${bestElo.elo} ELO` };
    if (bestStreak.streak > 0) results['Longest Streak'] = { ...bestStreak, value: `${bestStreak.streak} wins` };
    if (mostMatches.count > 0) results['Most Active'] = { ...mostMatches, value: `${mostMatches.count} matches` };
    if (bestScore.score > 0) results['Highest Score'] = { ...bestScore, value: `${Math.round(bestScore.score)} pts` };

    return results;
  }
}

export const superlativesService = new SuperlativesService();
