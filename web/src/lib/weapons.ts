/**
 * Weapon & Cosmetics System
 *
 * Weapons change how attacks look during battle.
 * Unlocked through wins, streaks, and achievements.
 * This is the "Fortnite skins" of Bot Trade Arena.
 */

export interface Weapon {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  unlockRequirement: string;
  unlockCheck: (stats: PlayerStats) => boolean;
  attackColor: string;
  hitEffect: 'sparks' | 'slash' | 'beam' | 'explosion' | 'lightning' | 'fire' | 'ice' | 'vortex';
  critEffect: string; // extra effect on big hits
  sound?: string; // future: sound effect name
}

export interface RobotSkin {
  id: string;
  name: string;
  bodyColor: string;
  eyeColor: string;
  glowColor: string;
  unlockRequirement: string;
  unlockCheck: (stats: PlayerStats) => boolean;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface PlayerStats {
  totalWins: number;
  totalMatches: number;
  winStreak: number;
  longestStreak: number;
  totalTrades: number;
}

export const WEAPONS: Weapon[] = [
  {
    id: 'fist', name: 'Iron Fist', emoji: '👊', description: 'The classic. Simple but effective.',
    rarity: 'common', unlockRequirement: 'Default', unlockCheck: () => true,
    attackColor: '#6366F1', hitEffect: 'sparks', critEffect: 'shockwave',
  },
  {
    id: 'sword', name: 'Plasma Blade', emoji: '⚔️', description: 'Slashes through the market like butter.',
    rarity: 'uncommon', unlockRequirement: '5 wins', unlockCheck: (s) => s.totalWins >= 5,
    attackColor: '#60A5FA', hitEffect: 'slash', critEffect: 'doubleslash',
  },
  {
    id: 'hammer', name: 'Mega Hammer', emoji: '🔨', description: 'Massive impact. Shakes the arena.',
    rarity: 'uncommon', unlockRequirement: '10 wins', unlockCheck: (s) => s.totalWins >= 10,
    attackColor: '#F59E0B', hitEffect: 'explosion', critEffect: 'earthquake',
  },
  {
    id: 'laser', name: 'Photon Beam', emoji: '🔫', description: 'Precision strikes from across the arena.',
    rarity: 'rare', unlockRequirement: '3 win streak', unlockCheck: (s) => s.longestStreak >= 3,
    attackColor: '#EF4444', hitEffect: 'beam', critEffect: 'overcharge',
  },
  {
    id: 'lightning', name: 'Thunder Strike', emoji: '⚡', description: 'Channels pure electricity. Devastating.',
    rarity: 'rare', unlockRequirement: '25 wins', unlockCheck: (s) => s.totalWins >= 25,
    attackColor: '#FBBF24', hitEffect: 'lightning', critEffect: 'thunderstorm',
  },
  {
    id: 'fire', name: 'Inferno Gauntlet', emoji: '🔥', description: 'Burns through opponents with flame attacks.',
    rarity: 'epic', unlockRequirement: '5 win streak', unlockCheck: (s) => s.longestStreak >= 5,
    attackColor: '#F97316', hitEffect: 'fire', critEffect: 'firestorm',
  },
  {
    id: 'ice', name: 'Frost Cannon', emoji: '❄️', description: 'Freezing cold precision. Chills to the core.',
    rarity: 'epic', unlockRequirement: '50 wins', unlockCheck: (s) => s.totalWins >= 50,
    attackColor: '#22D3EE', hitEffect: 'ice', critEffect: 'blizzard',
  },
  {
    id: 'vortex', name: 'Void Rift', emoji: '🌀', description: 'Tears reality itself. The ultimate weapon.',
    rarity: 'legendary', unlockRequirement: '10 win streak', unlockCheck: (s) => s.longestStreak >= 10,
    attackColor: '#A855F7', hitEffect: 'vortex', critEffect: 'blackhole',
  },
];

export const ROBOT_SKINS: RobotSkin[] = [
  { id: 'default', name: 'Standard', bodyColor: '#6366F1', eyeColor: '#6366F1', glowColor: '#6366F1', unlockRequirement: 'Default', unlockCheck: () => true, rarity: 'common' },
  { id: 'emerald', name: 'Emerald', bodyColor: '#10B981', eyeColor: '#34D399', glowColor: '#10B981', unlockRequirement: '10 matches', unlockCheck: (s) => s.totalMatches >= 10, rarity: 'common' },
  { id: 'crimson', name: 'Crimson', bodyColor: '#EF4444', eyeColor: '#FCA5A5', glowColor: '#EF4444', unlockRequirement: '15 wins', unlockCheck: (s) => s.totalWins >= 15, rarity: 'uncommon' },
  { id: 'gold', name: 'Golden', bodyColor: '#F59E0B', eyeColor: '#FCD34D', glowColor: '#F59E0B', unlockRequirement: '30 wins', unlockCheck: (s) => s.totalWins >= 30, rarity: 'rare' },
  { id: 'diamond', name: 'Diamond', bodyColor: '#60A5FA', eyeColor: '#BFDBFE', glowColor: '#60A5FA', unlockRequirement: '7 win streak', unlockCheck: (s) => s.longestStreak >= 7, rarity: 'epic' },
  { id: 'void', name: 'Void Walker', bodyColor: '#7C3AED', eyeColor: '#C4B5FD', glowColor: '#7C3AED', unlockRequirement: '100 wins', unlockCheck: (s) => s.totalWins >= 100, rarity: 'legendary' },
];

export const RARITY_COLORS: Record<string, string> = {
  common: '#94A3B8',
  uncommon: '#22C55E',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
};

export function getUnlockedWeapons(stats: PlayerStats): Weapon[] {
  return WEAPONS.filter(w => w.unlockCheck(stats));
}

export function getUnlockedSkins(stats: PlayerStats): RobotSkin[] {
  return ROBOT_SKINS.filter(s => s.unlockCheck(stats));
}

const isBrowser = typeof window !== 'undefined';

export function getPlayerStats(): PlayerStats {
  if (!isBrowser) return { totalWins: 0, totalMatches: 0, winStreak: 0, longestStreak: 0, totalTrades: 0 };
  return {
    totalWins: parseInt(localStorage.getItem('bta_total_wins') || '0'),
    totalMatches: parseInt(localStorage.getItem('bta_matches') || '0'),
    winStreak: parseInt(localStorage.getItem('bta_streak') || '0'),
    longestStreak: parseInt(localStorage.getItem('bta_longest_streak') || '0'),
    totalTrades: parseInt(localStorage.getItem('bta_total_trades') || '0'),
  };
}

export function updatePlayerStats(won: boolean, trades: number) {
  const stats = getPlayerStats();
  stats.totalMatches++;
  stats.totalTrades += trades;
  if (won) {
    stats.totalWins++;
    stats.winStreak++;
    stats.longestStreak = Math.max(stats.longestStreak, stats.winStreak);
  } else {
    stats.winStreak = 0;
  }
  if (isBrowser) {
    localStorage.setItem('bta_total_wins', String(stats.totalWins));
    localStorage.setItem('bta_matches', String(stats.totalMatches));
    localStorage.setItem('bta_streak', String(stats.winStreak));
    localStorage.setItem('bta_longest_streak', String(stats.longestStreak));
    localStorage.setItem('bta_total_trades', String(stats.totalTrades));
  }
  return stats;
}

export function getEquippedWeapon(): string {
  return isBrowser ? (localStorage.getItem('bta_weapon') || 'fist') : 'fist';
}

export function getEquippedSkin(): string {
  return isBrowser ? (localStorage.getItem('bta_skin') || 'default') : 'default';
}

export function equipWeapon(id: string) {
  if (isBrowser) localStorage.setItem('bta_weapon', id);
}

export function equipSkin(id: string) {
  if (isBrowser) localStorage.setItem('bta_skin', id);
}
