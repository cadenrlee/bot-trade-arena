/**
 * Bot Trade Arena — Database Seed Script
 *
 * Seeds the database with realistic fake data so the platform looks alive.
 * Safe to run multiple times (uses upsert where possible).
 *
 * Usage:  npx tsx scripts/seed.ts
 */

import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function tierFromElo(elo: number): string {
  if (elo >= 2000) return 'GRANDMASTER';
  if (elo >= 1800) return 'MASTER';
  if (elo >= 1600) return 'DIAMOND';
  if (elo >= 1400) return 'PLATINUM';
  if (elo >= 1200) return 'GOLD';
  if (elo >= 1000) return 'SILVER';
  return 'BRONZE';
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ---------------------------------------------------------------------------
// 1. Users
// ---------------------------------------------------------------------------

const userDefs = [
  { username: 'QuantWizard',    elo: 2050, wins: 142, losses: 38,  xp: 14200, level: 28 },
  { username: 'AlphaSeeker',    elo: 1920, wins: 118, losses: 42,  xp: 11800, level: 24 },
  { username: 'DeepTrader',     elo: 1870, wins: 105, losses: 45,  xp: 10500, level: 22 },
  { username: 'NeuralNet42',    elo: 1780, wins: 97,  losses: 53,  xp: 9700,  level: 20 },
  { username: 'CryptoSage',     elo: 1690, wins: 88,  losses: 52,  xp: 8800,  level: 18 },
  { username: 'BotMaster3000',  elo: 1650, wins: 82,  losses: 58,  xp: 8200,  level: 17 },
  { username: 'TrendSurfer',    elo: 1580, wins: 76,  losses: 64,  xp: 7600,  level: 16 },
  { username: 'VolumeKing',     elo: 1520, wins: 70,  losses: 60,  xp: 7000,  level: 15 },
  { username: 'SharpeStar',     elo: 1440, wins: 65,  losses: 65,  xp: 6500,  level: 14 },
  { username: 'DeltaForce',     elo: 1380, wins: 58,  losses: 62,  xp: 5800,  level: 12 },
  { username: 'ThetaGang',      elo: 1320, wins: 55,  losses: 65,  xp: 5500,  level: 11 },
  { username: 'GammaRay',       elo: 1260, wins: 50,  losses: 60,  xp: 5000,  level: 10 },
  { username: 'VegaStrike',     elo: 1200, wins: 45,  losses: 55,  xp: 4500,  level: 9 },
  { username: 'SigmaTrader',    elo: 1140, wins: 40,  losses: 60,  xp: 4000,  level: 8 },
  { username: 'PipHunter',      elo: 1080, wins: 35,  losses: 55,  xp: 3500,  level: 7 },
  { username: 'ZenTrader',      elo: 1020, wins: 30,  losses: 50,  xp: 3000,  level: 6 },
  { username: 'SwingKing',      elo: 960,  wins: 25,  losses: 45,  xp: 2500,  level: 5 },
  { username: 'MomentumMax',    elo: 920,  wins: 22,  losses: 48,  xp: 2200,  level: 4 },
  { username: 'MeanRevMike',    elo: 880,  wins: 18,  losses: 42,  xp: 1800,  level: 3 },
  { username: 'GridGuru',       elo: 850,  wins: 15,  losses: 45,  xp: 1500,  level: 2 },
];

// ---------------------------------------------------------------------------
// 2. Bots
// ---------------------------------------------------------------------------

const botDefs = [
  { name: 'AlphaStrike',      ownerIdx: 0,  lang: 'python',     elo: 2100, matches: 90,  wins: 68 },
  { name: 'QuantumEdge',      ownerIdx: 0,  lang: 'rust',       elo: 1980, matches: 72,  wins: 52 },
  { name: 'NeuralTrend',      ownerIdx: 1,  lang: 'python',     elo: 1940, matches: 85,  wins: 60 },
  { name: 'DeepMomentum',     ownerIdx: 2,  lang: 'python',     elo: 1890, matches: 78,  wins: 55 },
  { name: 'SynapseFlow',      ownerIdx: 3,  lang: 'typescript', elo: 1810, matches: 70,  wins: 48 },
  { name: 'GridMaster',       ownerIdx: 4,  lang: 'go',         elo: 1720, matches: 65,  wins: 44 },
  { name: 'ScalpBot9000',     ownerIdx: 5,  lang: 'rust',       elo: 1680, matches: 60,  wins: 40 },
  { name: 'TrendPilot',       ownerIdx: 6,  lang: 'python',     elo: 1600, matches: 58,  wins: 36 },
  { name: 'VolumeSniper',     ownerIdx: 7,  lang: 'typescript', elo: 1540, matches: 55,  wins: 33 },
  { name: 'SharpeShooter',    ownerIdx: 8,  lang: 'python',     elo: 1460, matches: 52,  wins: 30 },
  { name: 'DeltaEdge',        ownerIdx: 9,  lang: 'go',         elo: 1400, matches: 48,  wins: 26 },
  { name: 'ThetaCrusher',     ownerIdx: 10, lang: 'python',     elo: 1340, matches: 45,  wins: 24 },
  { name: 'GammaBurst',       ownerIdx: 11, lang: 'rust',       elo: 1280, matches: 42,  wins: 21 },
  { name: 'VegaRider',        ownerIdx: 12, lang: 'typescript', elo: 1220, matches: 40,  wins: 19 },
  { name: 'SigmaEngine',      ownerIdx: 13, lang: 'python',     elo: 1160, matches: 38,  wins: 17 },
  { name: 'PipSniper',        ownerIdx: 14, lang: 'go',         elo: 1100, matches: 35,  wins: 15 },
  { name: 'ZenFlow',          ownerIdx: 15, lang: 'python',     elo: 1040, matches: 32,  wins: 13 },
  { name: 'SwingTracer',      ownerIdx: 16, lang: 'typescript', elo: 980,  matches: 30,  wins: 11 },
  { name: 'MomentumWave',     ownerIdx: 17, lang: 'python',     elo: 940,  matches: 28,  wins: 10 },
  { name: 'MeanRevBot',       ownerIdx: 18, lang: 'rust',       elo: 900,  matches: 25,  wins: 8 },
  { name: 'GridRunner',       ownerIdx: 19, lang: 'go',         elo: 870,  matches: 22,  wins: 7 },
  // Extra bots — some users have 2 bots, some are templates
  { name: 'AlphaStrike-v2',   ownerIdx: 0,  lang: 'python',     elo: 1950, matches: 40, wins: 30 },
  { name: 'NeuralTrend-lite', ownerIdx: 1,  lang: 'typescript', elo: 1700, matches: 35, wins: 22 },
  { name: 'DeepScalp',        ownerIdx: 2,  lang: 'rust',       elo: 1650, matches: 30, wins: 18 },
  { name: 'CryptoWave',       ownerIdx: 4,  lang: 'python',     elo: 1550, matches: 28, wins: 16 },
  // Template bots
  { name: 'Momentum Starter', ownerIdx: 5,  lang: 'template:momentum',   elo: 1200, matches: 50, wins: 25 },
  { name: 'Mean Rev Starter', ownerIdx: 6,  lang: 'template:meanrev',    elo: 1150, matches: 45, wins: 20 },
  { name: 'Grid Starter',     ownerIdx: 7,  lang: 'template:grid',       elo: 1100, matches: 40, wins: 18 },
  { name: 'Scalp Starter',    ownerIdx: 8,  lang: 'template:scalp',      elo: 1050, matches: 38, wins: 15 },
  { name: 'Trend Starter',    ownerIdx: 9,  lang: 'template:trend',      elo: 1000, matches: 35, wins: 14 },
];

// ---------------------------------------------------------------------------
// 3. Achievements
// ---------------------------------------------------------------------------

const achievementDefs = [
  { key: 'first_match',       name: 'First Blood',         desc: 'Complete your first match',                         cat: 'MATCHES',   rarity: 'COMMON' },
  { key: '10_wins',           name: 'Getting Started',     desc: 'Win 10 matches',                                    cat: 'MATCHES',   rarity: 'COMMON' },
  { key: '50_wins',           name: 'Veteran Fighter',     desc: 'Win 50 matches',                                    cat: 'MATCHES',   rarity: 'UNCOMMON' },
  { key: '100_wins',          name: 'Centurion',           desc: 'Win 100 matches',                                   cat: 'MATCHES',   rarity: 'RARE' },
  { key: 'win_streak_5',      name: 'On Fire',             desc: 'Win 5 matches in a row',                            cat: 'STREAKS',   rarity: 'UNCOMMON' },
  { key: 'win_streak_10',     name: 'Unstoppable',         desc: 'Win 10 matches in a row',                           cat: 'STREAKS',   rarity: 'RARE' },
  { key: 'win_streak_20',     name: 'Legendary Streak',    desc: 'Win 20 matches in a row',                           cat: 'STREAKS',   rarity: 'LEGENDARY' },
  { key: 'reach_silver',      name: 'Silver Lining',       desc: 'Reach Silver tier',                                 cat: 'RANK',      rarity: 'COMMON' },
  { key: 'reach_gold',        name: 'Golden Age',          desc: 'Reach Gold tier',                                   cat: 'RANK',      rarity: 'UNCOMMON' },
  { key: 'reach_platinum',    name: 'Platinum Standard',   desc: 'Reach Platinum tier',                               cat: 'RANK',      rarity: 'RARE' },
  { key: 'reach_diamond',     name: 'Diamond Hands',       desc: 'Reach Diamond tier',                                cat: 'RANK',      rarity: 'EPIC' },
  { key: 'reach_master',      name: 'Master Trader',       desc: 'Reach Master tier',                                 cat: 'RANK',      rarity: 'EPIC' },
  { key: 'reach_grandmaster', name: 'Grandmaster',         desc: 'Reach Grandmaster tier',                            cat: 'RANK',      rarity: 'LEGENDARY' },
  { key: 'first_bot',         name: 'Bot Builder',         desc: 'Create your first bot',                             cat: 'BOTS',      rarity: 'COMMON' },
  { key: 'multi_bot',         name: 'Bot Army',            desc: 'Have 3 or more active bots',                        cat: 'BOTS',      rarity: 'UNCOMMON' },
  { key: 'tournament_win',    name: 'Tournament Champion', desc: 'Win a tournament',                                  cat: 'TOURNAMENTS', rarity: 'EPIC' },
  { key: 'tournament_top3',   name: 'Podium Finish',       desc: 'Finish top 3 in a tournament',                      cat: 'TOURNAMENTS', rarity: 'RARE' },
  { key: 'challenge_clear',   name: 'Challenge Accepted',  desc: 'Complete a challenge',                              cat: 'CHALLENGES',  rarity: 'COMMON' },
  { key: 'all_challenges',    name: 'Challenge Master',    desc: 'Complete all challenges',                           cat: 'CHALLENGES',  rarity: 'LEGENDARY' },
  { key: 'pnl_1000',          name: 'Big Earner',          desc: 'Accumulate $1,000 in total P&L',                    cat: 'PNL',       rarity: 'UNCOMMON' },
  { key: 'pnl_10000',         name: 'Whale',               desc: 'Accumulate $10,000 in total P&L',                   cat: 'PNL',       rarity: 'RARE' },
  { key: 'sharpe_2',          name: 'Risk Wizard',         desc: 'Achieve a Sharpe ratio above 2.0 in a match',       cat: 'SKILL',     rarity: 'RARE' },
  { key: 'sharpe_3',          name: 'Sharpe Legend',        desc: 'Achieve a Sharpe ratio above 3.0 in a match',       cat: 'SKILL',     rarity: 'EPIC' },
  { key: 'perfect_score',     name: 'Perfect Score',       desc: 'Achieve a composite score above 750',               cat: 'SKILL',     rarity: 'LEGENDARY' },
  { key: 'daily_streak_7',    name: 'Week Warrior',        desc: 'Maintain a 7-day activity streak',                  cat: 'STREAKS',   rarity: 'UNCOMMON' },
  { key: 'daily_streak_30',   name: 'Iron Dedication',     desc: 'Maintain a 30-day activity streak',                 cat: 'STREAKS',   rarity: 'EPIC' },
  { key: 'season_top10',      name: 'Season Elite',        desc: 'Finish a season in the top 10',                     cat: 'SEASONS',   rarity: 'EPIC' },
  { key: 'clan_member',       name: 'Team Player',         desc: 'Join a clan',                                       cat: 'SOCIAL',    rarity: 'COMMON' },
];

// ---------------------------------------------------------------------------
// 4. Challenges
// ---------------------------------------------------------------------------

const challengeDefs = [
  { name: 'Beat the Index',    desc: 'Outperform the S&P 500 benchmark over a simulated 30-day period.',       type: 'BEAT_BENCHMARK', diff: 'GOLD',     dur: 1800, symbols: '["BTCUSDT","ETHUSDT","SOLUSDT"]', benchmark: 8.5 },
  { name: 'Survive the Crash', desc: 'Maintain positive equity during a simulated flash crash scenario.',      type: 'SURVIVE',        diff: 'PLATINUM',  dur: 900,  symbols: '["BTCUSDT"]',                       benchmark: 0 },
  { name: 'Speed Trading',     desc: 'Execute 100 profitable trades within 15 minutes of match time.',         type: 'MAX_RETURN',     diff: 'SILVER',    dur: 900,  symbols: '["BTCUSDT","ETHUSDT"]',              benchmark: 100 },
  { name: 'Low Risk Champion', desc: 'Win a match while keeping your max drawdown under 2%.',                  type: 'CONSTRAINT',     diff: 'DIAMOND',   dur: 1800, symbols: '["BTCUSDT","ETHUSDT","BNBUSDT"]',   benchmark: 2.0 },
  { name: 'Volatility Master', desc: 'Generate 15% returns during a high-volatility simulated environment.',   type: 'MAX_RETURN',     diff: 'MASTER',    dur: 1200, symbols: '["BTCUSDT","DOGEUSDT"]',             benchmark: 15.0 },
];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Seeding Bot Trade Arena database...\n');

  const passwordHash = await bcrypt.hash('demo123', 10);

  // -----------------------------------------------------------------------
  // Users
  // -----------------------------------------------------------------------
  console.log('👤 Creating 20 users...');
  const users = [];
  for (const u of userDefs) {
    const totalMatches = u.wins + u.losses;
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {
        elo: u.elo,
        tier: tierFromElo(u.elo),
        totalWins: u.wins,
        totalLosses: u.losses,
        totalMatches,
        xp: u.xp,
        level: u.level,
        lastActiveAt: daysAgo(randomBetween(0, 5)),
      },
      create: {
        email: `${u.username.toLowerCase()}@bottradearena.demo`,
        username: u.username,
        displayName: u.username,
        passwordHash,
        elo: u.elo,
        tier: tierFromElo(u.elo),
        totalWins: u.wins,
        totalLosses: u.losses,
        totalMatches,
        xp: u.xp,
        level: u.level,
        credits: randomBetween(100, 5000),
        lastActiveAt: daysAgo(randomBetween(0, 5)),
      },
    });
    users.push(user);
  }

  // -----------------------------------------------------------------------
  // Bots
  // -----------------------------------------------------------------------
  console.log('🤖 Creating 30 bots...');
  const bots = [];
  for (const b of botDefs) {
    const losses = b.matches - b.wins;
    const draws = randomBetween(0, Math.min(5, losses));
    const avgScore = randomFloat(300, 700);
    const bestScore = randomFloat(avgScore, 800);
    const winStreak = randomBetween(0, 12);
    const bestWinStreak = randomBetween(winStreak, winStreak + 5);

    // Use name + owner combo as a unique lookup — upsert on bot name per user
    const existing = await prisma.bot.findFirst({
      where: { name: b.name, userId: users[b.ownerIdx].id },
    });

    let bot;
    if (existing) {
      bot = await prisma.bot.update({
        where: { id: existing.id },
        data: {
          elo: b.elo,
          totalMatches: b.matches,
          totalWins: b.wins,
          totalLosses: losses - draws,
          totalDraws: draws,
          avgScore,
          bestScore,
          winStreak,
          bestWinStreak,
          language: b.lang,
          isPublic: Math.random() > 0.3,
          status: pickRandom(['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE']),
          lastConnected: daysAgo(randomBetween(0, 7)),
        },
      });
    } else {
      bot = await prisma.bot.create({
        data: {
          userId: users[b.ownerIdx].id,
          name: b.name,
          description: `${b.name} — a ${b.lang} trading bot`,
          language: b.lang,
          elo: b.elo,
          totalMatches: b.matches,
          totalWins: b.wins,
          totalLosses: losses - draws,
          totalDraws: draws,
          avgScore,
          bestScore,
          winStreak,
          bestWinStreak,
          isPublic: Math.random() > 0.3,
          status: pickRandom(['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE']),
          lastConnected: daysAgo(randomBetween(0, 7)),
        },
      });
    }
    bots.push(bot);
  }

  // -----------------------------------------------------------------------
  // Matches (50 completed)
  // -----------------------------------------------------------------------
  console.log('⚔️  Creating 50 completed matches...');
  const marketOptions = [
    '["BTCUSDT","ETHUSDT"]',
    '["BTCUSDT"]',
    '["ETHUSDT","SOLUSDT"]',
    '["BTCUSDT","ETHUSDT","BNBUSDT"]',
    '["BTCUSDT","DOGEUSDT"]',
  ];
  const matchIds: string[] = [];

  for (let i = 0; i < 50; i++) {
    const idx1 = randomBetween(0, bots.length - 1);
    let idx2 = randomBetween(0, bots.length - 1);
    while (idx2 === idx1) idx2 = randomBetween(0, bots.length - 1);

    const bot1 = bots[idx1];
    const bot2 = bots[idx2];

    // Figure out owners
    const owner1Id = bot1.userId;
    const owner2Id = bot2.userId;

    const bot1Score = randomFloat(300, 800);
    const bot2Score = randomFloat(300, 800);
    const winnerId = bot1Score >= bot2Score ? owner1Id : owner2Id;

    const bot1Pnl = randomFloat(-500, 2000);
    const bot2Pnl = randomFloat(-500, 2000);
    const eloChange = randomBetween(5, 25);

    const startDay = randomBetween(1, 30);
    const startedAt = daysAgo(startDay);
    const endedAt = new Date(startedAt.getTime() + randomBetween(600, 3600) * 1000);

    const tier = pickRandom(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER']);

    const match = await prisma.match.create({
      data: {
        player1Id: owner1Id,
        player2Id: owner2Id,
        bot1Id: bot1.id,
        bot2Id: bot2.id,
        mode: pickRandom(['LIVE', 'ASYNC']),
        format: 'LADDER',
        duration: pickRandom([900, 1200, 1800]),
        marketSymbols: pickRandom(marketOptions),
        tier,
        status: 'COMPLETED',
        startedAt,
        endedAt,
        winnerId,
        bot1Score,
        bot2Score,
        bot1Pnl,
        bot2Pnl,
        bot1WinRate: randomFloat(0.3, 0.9),
        bot2WinRate: randomFloat(0.3, 0.9),
        bot1Sharpe: randomFloat(0.2, 3.5),
        bot2Sharpe: randomFloat(0.2, 3.5),
        bot1MaxDd: randomFloat(1, 15),
        bot2MaxDd: randomFloat(1, 15),
        bot1Trades: randomBetween(20, 200),
        bot2Trades: randomBetween(20, 200),
        eloChange1: bot1Score >= bot2Score ? eloChange : -eloChange,
        eloChange2: bot1Score >= bot2Score ? -eloChange : eloChange,
        createdAt: startedAt,
      },
    });
    matchIds.push(match.id);
  }

  // -----------------------------------------------------------------------
  // Season
  // -----------------------------------------------------------------------
  console.log('🏆 Creating Season 1...');
  const season = await prisma.season.upsert({
    where: { number: 1 },
    update: {
      isActive: true,
      endDate: daysFromNow(60),
    },
    create: {
      name: 'Season 1: Crypto Summer',
      description: 'The inaugural Bot Trade Arena season — prove your bots against the best.',
      number: 1,
      startDate: daysAgo(30),
      endDate: daysFromNow(60),
      isActive: true,
      allowedSymbols: '["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","DOGEUSDT"]',
      theme: 'crypto_summer',
    },
  });

  // Season entries for top 15 users
  console.log('📊 Creating season entries for top 15 users...');
  for (let i = 0; i < 15; i++) {
    const u = users[i];
    const seasonElo = u.elo + randomBetween(-100, 50);
    const sWins = Math.floor(u.totalWins * 0.3);
    const sLosses = Math.floor(u.totalLosses * 0.3);
    await prisma.seasonEntry.upsert({
      where: { userId_seasonId: { userId: u.id, seasonId: season.id } },
      update: {
        elo: seasonElo,
        tier: tierFromElo(seasonElo),
        wins: sWins,
        losses: sLosses,
        avgScore: randomFloat(350, 700),
        peakElo: seasonElo + randomBetween(0, 80),
        peakTier: tierFromElo(seasonElo + 80),
      },
      create: {
        userId: u.id,
        seasonId: season.id,
        elo: seasonElo,
        tier: tierFromElo(seasonElo),
        wins: sWins,
        losses: sLosses,
        avgScore: randomFloat(350, 700),
        peakElo: seasonElo + randomBetween(0, 80),
        peakTier: tierFromElo(seasonElo + 80),
      },
    });
  }

  // -----------------------------------------------------------------------
  // Tournaments
  // -----------------------------------------------------------------------
  console.log('🏟️  Creating tournaments...');

  // Completed tournament
  const completedTournament = await prisma.tournament.upsert({
    where: { id: 'seed-tourney-12' },
    update: {},
    create: {
      id: 'seed-tourney-12',
      name: 'Weekly Arena #12',
      description: 'Weekly arena tournament — top 16 compete for glory and credits.',
      seasonId: season.id,
      format: 'SINGLE_ELIM',
      tier: 'GOLD',
      maxEntrants: 16,
      entryFee: 50,
      prizePool: 2000,
      registrationOpen: daysAgo(10),
      registrationClose: daysAgo(8),
      startDate: daysAgo(7),
      endDate: daysAgo(6),
      status: 'COMPLETED',
    },
  });

  // Tournament entries with placements
  const entrants = users.slice(0, 16);
  for (let i = 0; i < entrants.length; i++) {
    const u = entrants[i];
    const bot = bots.find((b) => b.userId === u.id);
    if (!bot) continue;

    await prisma.tournamentEntry.upsert({
      where: { tournamentId_userId: { tournamentId: completedTournament.id, userId: u.id } },
      update: {
        placement: i + 1,
        wins: Math.max(0, 4 - i),
        losses: i < 4 ? i : randomBetween(1, 3),
        prizePayout: i === 0 ? 1000 : i === 1 ? 500 : i === 2 ? 300 : i === 3 ? 200 : 0,
      },
      create: {
        tournamentId: completedTournament.id,
        userId: u.id,
        botId: bot.id,
        seed: i + 1,
        placement: i + 1,
        wins: Math.max(0, 4 - i),
        losses: i < 4 ? i : randomBetween(1, 3),
        prizePayout: i === 0 ? 1000 : i === 1 ? 500 : i === 2 ? 300 : i === 3 ? 200 : 0,
      },
    });
  }

  // Upcoming tournament
  await prisma.tournament.upsert({
    where: { id: 'seed-tourney-13' },
    update: {},
    create: {
      id: 'seed-tourney-13',
      name: 'Weekly Arena #13',
      description: 'Next weekly arena — registration open now!',
      seasonId: season.id,
      format: 'SINGLE_ELIM',
      tier: 'GOLD',
      maxEntrants: 16,
      entryFee: 50,
      prizePool: 2000,
      registrationOpen: daysAgo(1),
      registrationClose: daysFromNow(1),
      startDate: daysFromNow(2),
      endDate: daysFromNow(3),
      status: 'UPCOMING',
    },
  });

  // -----------------------------------------------------------------------
  // Challenges
  // -----------------------------------------------------------------------
  console.log('🎯 Creating 5 challenges...');
  for (const c of challengeDefs) {
    await prisma.challenge.upsert({
      where: { id: `seed-challenge-${c.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {
        description: c.desc,
        type: c.type,
        difficulty: c.diff,
        duration: c.dur,
        marketSymbols: c.symbols,
        benchmark: c.benchmark,
        isActive: true,
      },
      create: {
        id: `seed-challenge-${c.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: c.name,
        description: c.desc,
        type: c.type,
        difficulty: c.diff,
        duration: c.dur,
        marketSymbols: c.symbols,
        benchmark: c.benchmark,
        isActive: true,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Leaderboard entries
  // -----------------------------------------------------------------------
  console.log('📈 Creating leaderboard entries...');
  const today = new Date().toISOString().slice(0, 10);
  const weekKey = `week-${today}`;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const topBot = bots.find((b) => b.userId === u.id);

    // Daily
    await prisma.leaderboardEntry.upsert({
      where: { userId_period_periodKey: { userId: u.id, period: 'DAILY', periodKey: today } },
      update: {
        rank: i + 1,
        elo: u.elo,
        tier: tierFromElo(u.elo),
        wins: randomBetween(0, 5),
        losses: randomBetween(0, 3),
        avgScore: randomFloat(350, 700),
        totalPnl: randomFloat(-200, 1500),
      },
      create: {
        userId: u.id,
        botId: topBot?.id ?? null,
        period: 'DAILY',
        periodKey: today,
        rank: i + 1,
        elo: u.elo,
        tier: tierFromElo(u.elo),
        wins: randomBetween(0, 5),
        losses: randomBetween(0, 3),
        avgScore: randomFloat(350, 700),
        totalPnl: randomFloat(-200, 1500),
      },
    });

    // Weekly
    await prisma.leaderboardEntry.upsert({
      where: { userId_period_periodKey: { userId: u.id, period: 'WEEKLY', periodKey: weekKey } },
      update: {
        rank: i + 1,
        elo: u.elo,
        tier: tierFromElo(u.elo),
        wins: randomBetween(5, 20),
        losses: randomBetween(2, 10),
        avgScore: randomFloat(350, 700),
        totalPnl: randomFloat(-500, 5000),
      },
      create: {
        userId: u.id,
        botId: topBot?.id ?? null,
        period: 'WEEKLY',
        periodKey: weekKey,
        rank: i + 1,
        elo: u.elo,
        tier: tierFromElo(u.elo),
        wins: randomBetween(5, 20),
        losses: randomBetween(2, 10),
        avgScore: randomFloat(350, 700),
        totalPnl: randomFloat(-500, 5000),
      },
    });

    // All-time
    await prisma.leaderboardEntry.upsert({
      where: { userId_period_periodKey: { userId: u.id, period: 'ALL_TIME', periodKey: 'all' } },
      update: {
        rank: i + 1,
        elo: u.elo,
        tier: tierFromElo(u.elo),
        wins: u.totalWins,
        losses: u.totalLosses,
        avgScore: randomFloat(350, 700),
        totalPnl: randomFloat(500, 20000),
      },
      create: {
        userId: u.id,
        botId: topBot?.id ?? null,
        period: 'ALL_TIME',
        periodKey: 'all',
        rank: i + 1,
        elo: u.elo,
        tier: tierFromElo(u.elo),
        wins: u.totalWins,
        losses: u.totalLosses,
        avgScore: randomFloat(350, 700),
        totalPnl: randomFloat(500, 20000),
      },
    });
  }

  // -----------------------------------------------------------------------
  // Achievements
  // -----------------------------------------------------------------------
  console.log('🏅 Seeding achievements...');
  for (const a of achievementDefs) {
    await prisma.achievement.upsert({
      where: { key: a.key },
      update: {
        name: a.name,
        description: a.desc,
        category: a.cat,
        rarity: a.rarity,
      },
      create: {
        key: a.key,
        name: a.name,
        description: a.desc,
        category: a.cat,
        rarity: a.rarity,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  const [userCount, botCount, matchCount, seasonCount, tournamentCount, challengeCount, leaderboardCount, achievementCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.bot.count(),
      prisma.match.count(),
      prisma.season.count(),
      prisma.tournament.count(),
      prisma.challenge.count(),
      prisma.leaderboardEntry.count(),
      prisma.achievement.count(),
    ]);

  console.log('\n✅ Seed complete! Database summary:');
  console.log(`   Users:              ${userCount}`);
  console.log(`   Bots:               ${botCount}`);
  console.log(`   Matches:            ${matchCount}`);
  console.log(`   Seasons:            ${seasonCount}`);
  console.log(`   Tournaments:        ${tournamentCount}`);
  console.log(`   Challenges:         ${challengeCount}`);
  console.log(`   Leaderboard rows:   ${leaderboardCount}`);
  console.log(`   Achievements:       ${achievementCount}`);
  console.log('\n   All demo accounts use password: demo123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
