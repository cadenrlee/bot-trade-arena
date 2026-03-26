/**
 * Battle Pass & Monetization System
 *
 * Free tier: Quick Battle, basic weapons, leaderboard
 * Battle Pass ($4.99/season): 50 tiers of rewards, exclusive weapons/skins
 * Pro ($9.99/mo): Ranked mode, connect your own bot, advanced analytics
 *
 * Battle Pass tiers unlock through XP earned from:
 * - Winning battles: 100 XP
 * - Losing battles: 30 XP (you still get something)
 * - Win streaks: bonus 50 XP per streak win
 * - Daily first win: 200 XP bonus
 * - Completing challenges: 150 XP
 */

export interface BattlePassTier {
  level: number;
  xpRequired: number; // cumulative XP to reach this tier
  freeReward?: { type: 'credits' | 'weapon' | 'skin' | 'title'; id: string; name: string; amount?: number };
  premiumReward?: { type: 'credits' | 'weapon' | 'skin' | 'title' | 'effect'; id: string; name: string; amount?: number };
}

export const SEASON_NAME = 'Season 1: First Blood';
export const SEASON_END = new Date('2026-06-25');

export const BATTLE_PASS_TIERS: BattlePassTier[] = Array.from({ length: 50 }, (_, i) => {
  const level = i + 1;
  const xpRequired = level * 200; // 200 XP per level

  // Every 5 levels = something good
  const isMilestone = level % 5 === 0;
  const isBigMilestone = level % 10 === 0;

  let freeReward: BattlePassTier['freeReward'];
  let premiumReward: BattlePassTier['premiumReward'];

  // Free track
  if (level <= 5) freeReward = { type: 'credits', id: 'credits', name: `${level * 50} Credits`, amount: level * 50 };
  else if (level === 10) freeReward = { type: 'title', id: 'title_rookie', name: '"Rookie Trader" Title' };
  else if (level === 20) freeReward = { type: 'weapon', id: 'sword', name: 'Plasma Blade' };
  else if (level === 30) freeReward = { type: 'skin', id: 'emerald', name: 'Emerald Skin' };
  else if (level === 40) freeReward = { type: 'weapon', id: 'hammer', name: 'Mega Hammer' };
  else if (level === 50) freeReward = { type: 'title', id: 'title_veteran', name: '"Veteran" Title' };
  else if (isMilestone) freeReward = { type: 'credits', id: 'credits', name: `${level * 20} Credits`, amount: level * 20 };
  else freeReward = { type: 'credits', id: 'credits', name: `${50} Credits`, amount: 50 };

  // Premium track — better stuff
  if (level === 1) premiumReward = { type: 'skin', id: 'bp_neon', name: 'Neon Skin (Exclusive)' };
  else if (level === 5) premiumReward = { type: 'weapon', id: 'bp_katana', name: 'Plasma Katana' };
  else if (level === 10) premiumReward = { type: 'effect', id: 'bp_flames', name: 'Flame Trail Effect' };
  else if (level === 15) premiumReward = { type: 'skin', id: 'bp_chrome', name: 'Chrome Skin' };
  else if (level === 20) premiumReward = { type: 'weapon', id: 'bp_railgun', name: 'Railgun' };
  else if (level === 25) premiumReward = { type: 'title', id: 'title_elite', name: '"Elite Trader" Title' };
  else if (level === 30) premiumReward = { type: 'effect', id: 'bp_lightning', name: 'Lightning Aura' };
  else if (level === 35) premiumReward = { type: 'skin', id: 'bp_shadow', name: 'Shadow Skin' };
  else if (level === 40) premiumReward = { type: 'weapon', id: 'bp_darkstar', name: 'Dark Star' };
  else if (level === 45) premiumReward = { type: 'effect', id: 'bp_voidwalk', name: 'Void Walk Effect' };
  else if (level === 50) premiumReward = { type: 'skin', id: 'bp_legendary', name: 'Legendary Skin (Animated)' };
  else if (isMilestone) premiumReward = { type: 'credits', id: 'credits', name: `${level * 40} Credits`, amount: level * 40 };
  else premiumReward = { type: 'credits', id: 'credits', name: `${100} Credits`, amount: 100 };

  return { level, xpRequired, freeReward, premiumReward };
});

const isBrowser = typeof window !== 'undefined';

export function getBattlePassState() {
  if (!isBrowser) return { xp: 0, level: 1, hasPremium: false, dailyBonusClaimed: false };
  return {
    xp: parseInt(localStorage.getItem('bta_bp_xp') || '0'),
    level: parseInt(localStorage.getItem('bta_bp_level') || '1'),
    hasPremium: localStorage.getItem('bta_bp_premium') === 'true',
    dailyBonusClaimed: localStorage.getItem('bta_bp_daily') === new Date().toDateString(),
  };
}

export function addBattlePassXP(amount: number): { newXP: number; newLevel: number; leveledUp: boolean; reward?: BattlePassTier } {
  if (!isBrowser) return { newXP: 0, newLevel: 1, leveledUp: false };

  let xp = parseInt(localStorage.getItem('bta_bp_xp') || '0') + amount;
  let level = parseInt(localStorage.getItem('bta_bp_level') || '1');
  let leveledUp = false;
  let reward: BattlePassTier | undefined;

  // Check for level up
  while (level < 50) {
    const tier = BATTLE_PASS_TIERS[level - 1];
    if (xp >= tier.xpRequired) {
      xp -= tier.xpRequired;
      level++;
      leveledUp = true;
      reward = BATTLE_PASS_TIERS[level - 1];
    } else {
      break;
    }
  }

  localStorage.setItem('bta_bp_xp', String(xp));
  localStorage.setItem('bta_bp_level', String(level));

  return { newXP: xp, newLevel: level, leveledUp, reward };
}

export function claimDailyBonus(): number {
  if (!isBrowser) return 0;
  localStorage.setItem('bta_bp_daily', new Date().toDateString());
  return 200; // bonus XP
}

export function getXPForCurrentLevel(): { current: number; needed: number } {
  const state = getBattlePassState();
  const tier = BATTLE_PASS_TIERS[Math.min(state.level - 1, 49)];
  return { current: state.xp, needed: tier?.xpRequired || 200 };
}

export function purchaseBattlePass(): boolean {
  if (!isBrowser) return false;
  localStorage.setItem('bta_bp_premium', 'true');
  return true;
}
