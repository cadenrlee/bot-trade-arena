'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  WEAPONS,
  ROBOT_SKINS,
  RARITY_COLORS,
  getUnlockedWeapons,
  getUnlockedSkins,
  getPlayerStats,
  equipWeapon,
  equipSkin,
  getEquippedWeapon,
  getEquippedSkin,
  type Weapon,
  type RobotSkin,
  type PlayerStats,
} from '@/lib/weapons';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// --- Helpers -----------------------------------------------------------------

function getUnlockProgress(weapon: Weapon, stats: PlayerStats): number {
  const req = weapon.unlockRequirement.toLowerCase();

  const winMatch = req.match(/(\d+)\s*wins?$/);
  if (winMatch) return Math.min(1, stats.totalWins / parseInt(winMatch[1]));

  const streakMatch = req.match(/(\d+)\s*win\s*streak/);
  if (streakMatch) return Math.min(1, stats.longestStreak / parseInt(streakMatch[1]));

  const matchMatch = req.match(/(\d+)\s*match/);
  if (matchMatch) return Math.min(1, stats.totalMatches / parseInt(matchMatch[1]));

  return weapon.unlockCheck(stats) ? 1 : 0;
}

function getSkinUnlockProgress(skin: RobotSkin, stats: PlayerStats): number {
  const req = skin.unlockRequirement.toLowerCase();

  const winMatch = req.match(/(\d+)\s*wins?$/);
  if (winMatch) return Math.min(1, stats.totalWins / parseInt(winMatch[1]));

  const streakMatch = req.match(/(\d+)\s*win\s*streak/);
  if (streakMatch) return Math.min(1, stats.longestStreak / parseInt(streakMatch[1]));

  const matchMatch = req.match(/(\d+)\s*match/);
  if (matchMatch) return Math.min(1, stats.totalMatches / parseInt(matchMatch[1]));

  return skin.unlockCheck(stats) ? 1 : 0;
}

function rarityLabel(rarity: string): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

// --- Robot Preview -----------------------------------------------------------

function RobotPreview({
  bodyColor,
  eyeColor,
  glowColor,
  weaponEmoji,
}: {
  bodyColor: string;
  eyeColor: string;
  glowColor: string;
  weaponEmoji: string;
}) {
  return (
    <div className="relative flex flex-col items-center">
      <div
        className="absolute top-4 w-32 h-32 rounded-full blur-2xl opacity-30"
        style={{ backgroundColor: glowColor }}
      />
      <div
        className="relative w-28 h-32 rounded-2xl flex items-center justify-center border-2"
        style={{
          backgroundColor: `${bodyColor}20`,
          borderColor: `${bodyColor}60`,
          boxShadow: `0 0 30px ${glowColor}30, inset 0 0 20px ${glowColor}10`,
        }}
      >
        <div className="text-center">
          <div className="flex gap-3 justify-center mb-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{
                backgroundColor: eyeColor,
                boxShadow: `0 0 8px ${eyeColor}, 0 0 16px ${eyeColor}60`,
              }}
            />
            <div
              className="w-4 h-4 rounded-full"
              style={{
                backgroundColor: eyeColor,
                boxShadow: `0 0 8px ${eyeColor}, 0 0 16px ${eyeColor}60`,
              }}
            />
          </div>
          <div
            className="w-10 h-2 rounded-full mx-auto"
            style={{ backgroundColor: `${bodyColor}60` }}
          />
        </div>
      </div>
      <div className="mt-3 text-3xl">{weaponEmoji}</div>
    </div>
  );
}

// --- Weapon Card -------------------------------------------------------------

function WeaponCard({
  weapon,
  isUnlocked,
  isEquipped,
  progress,
  onEquip,
}: {
  weapon: Weapon;
  isUnlocked: boolean;
  isEquipped: boolean;
  progress: number;
  onEquip: () => void;
}) {
  const rarityColor = RARITY_COLORS[weapon.rarity];

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        isEquipped && 'ring-2',
        !isUnlocked && 'opacity-70',
      )}
      style={{
        borderColor: isEquipped ? rarityColor : undefined,
        boxShadow: isEquipped ? `0 0 20px ${rarityColor}30` : undefined,
      }}
    >
      {/* Rarity glow at top */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)` }}
      />

      {isEquipped && (
        <div
          className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-bold"
          style={{
            backgroundColor: `${rarityColor}20`,
            color: rarityColor,
            border: `1px solid ${rarityColor}40`,
          }}
        >
          Equipped
        </div>
      )}

      {!isUnlocked && (
        <div className="absolute top-3 right-3 text-[var(--text-tertiary)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      )}

      <div className={cn('space-y-3', !isUnlocked && 'grayscale')}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{weapon.emoji}</span>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)] text-sm">
              {weapon.name}
            </h3>
            <span
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: rarityColor }}
            >
              {rarityLabel(weapon.rarity)}
            </span>
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {weapon.description}
        </p>

        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: weapon.attackColor,
              boxShadow: `0 0 6px ${weapon.attackColor}`,
            }}
          />
          <span className="text-xs text-[var(--text-tertiary)] font-[var(--font-mono)]">
            {weapon.hitEffect}
          </span>
        </div>

        {!isUnlocked ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-tertiary)]">
                {weapon.unlockRequirement}
              </span>
              <span className="text-xs font-[var(--font-mono)] text-[var(--text-tertiary)]">
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress * 100}%`,
                  background: `linear-gradient(90deg, ${rarityColor}80, ${rarityColor})`,
                }}
              />
            </div>
          </div>
        ) : !isEquipped ? (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={onEquip}
          >
            Equip
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

// --- Skin Card ---------------------------------------------------------------

function SkinCard({
  skin,
  isUnlocked,
  isEquipped,
  progress,
  onEquip,
}: {
  skin: RobotSkin;
  isUnlocked: boolean;
  isEquipped: boolean;
  progress: number;
  onEquip: () => void;
}) {
  const rarityColor = RARITY_COLORS[skin.rarity];

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        isEquipped && 'ring-2',
        !isUnlocked && 'opacity-70',
      )}
      style={{
        borderColor: isEquipped ? rarityColor : undefined,
        boxShadow: isEquipped ? `0 0 20px ${rarityColor}30` : undefined,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)` }}
      />

      {isEquipped && (
        <div
          className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-bold"
          style={{
            backgroundColor: `${rarityColor}20`,
            color: rarityColor,
            border: `1px solid ${rarityColor}40`,
          }}
        >
          Equipped
        </div>
      )}

      {!isUnlocked && (
        <div className="absolute top-3 right-3 text-[var(--text-tertiary)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      )}

      <div className={cn('space-y-3', !isUnlocked && 'grayscale')}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div
              className="w-8 h-8 rounded-full border-2"
              style={{
                backgroundColor: skin.bodyColor,
                borderColor: `${skin.bodyColor}80`,
                boxShadow: `0 0 10px ${skin.glowColor}40`,
              }}
            />
            <div
              className="w-5 h-5 rounded-full border"
              style={{
                backgroundColor: skin.eyeColor,
                borderColor: `${skin.eyeColor}60`,
                boxShadow: `0 0 6px ${skin.eyeColor}40`,
              }}
            />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)] text-sm">
              {skin.name}
            </h3>
            <span
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: rarityColor }}
            >
              {rarityLabel(skin.rarity)}
            </span>
          </div>
        </div>

        <div className="flex justify-center py-2">
          <div
            className="w-14 h-16 rounded-xl flex items-center justify-center border"
            style={{
              backgroundColor: `${skin.bodyColor}15`,
              borderColor: `${skin.bodyColor}40`,
            }}
          >
            <div className="text-center">
              <div className="flex gap-1.5 justify-center mb-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: skin.eyeColor }}
                />
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: skin.eyeColor }}
                />
              </div>
              <div
                className="w-5 h-1 rounded-full mx-auto"
                style={{ backgroundColor: `${skin.bodyColor}50` }}
              />
            </div>
          </div>
        </div>

        {!isUnlocked ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-tertiary)]">
                {skin.unlockRequirement}
              </span>
              <span className="text-xs font-[var(--font-mono)] text-[var(--text-tertiary)]">
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress * 100}%`,
                  background: `linear-gradient(90deg, ${rarityColor}80, ${rarityColor})`,
                }}
              />
            </div>
          </div>
        ) : !isEquipped ? (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={onEquip}
          >
            Equip
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

// --- Main Armory Page --------------------------------------------------------

export default function ArmoryPage() {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [equippedWeaponId, setEquippedWeaponId] = useState<string>('fist');
  const [equippedSkinId, setEquippedSkinId] = useState<string>('default');
  const [tab, setTab] = useState<'weapons' | 'skins'>('weapons');

  useEffect(() => {
    setStats(getPlayerStats());
    setEquippedWeaponId(getEquippedWeapon());
    setEquippedSkinId(getEquippedSkin());
  }, []);

  const handleEquipWeapon = useCallback((id: string) => {
    equipWeapon(id);
    setEquippedWeaponId(id);
  }, []);

  const handleEquipSkin = useCallback((id: string) => {
    equipSkin(id);
    setEquippedSkinId(id);
  }, []);

  if (!stats) return null;

  const unlockedWeapons = getUnlockedWeapons(stats);
  const unlockedSkins = getUnlockedSkins(stats);
  const unlockedWeaponIds = new Set(unlockedWeapons.map((w) => w.id));
  const unlockedSkinIds = new Set(unlockedSkins.map((s) => s.id));

  const equippedWeapon = WEAPONS.find((w) => w.id === equippedWeaponId) || WEAPONS[0];
  const equippedSkin = ROBOT_SKINS.find((s) => s.id === equippedSkinId) || ROBOT_SKINS[0];

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
            Armory
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Equip weapons and skins for your battle robot
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <div className="text-lg font-bold font-[var(--font-mono)] text-[var(--accent-emerald)]">
              {stats.totalWins}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">Wins</div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <div className="text-lg font-bold font-[var(--font-mono)] text-[var(--accent-amber)]">
              {stats.longestStreak}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">Best Streak</div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <div className="text-lg font-bold font-[var(--font-mono)] text-[var(--text-secondary)]">
              {stats.totalMatches}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">Matches</div>
          </div>
        </div>
      </div>

      {/* Preview section */}
      <Card className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 py-8">
        <RobotPreview
          bodyColor={equippedSkin.bodyColor}
          eyeColor={equippedSkin.eyeColor}
          glowColor={equippedSkin.glowColor}
          weaponEmoji={equippedWeapon.emoji}
        />
        <div className="space-y-2 text-center sm:text-left">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-[var(--font-display)]">
            Your Fighter
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{
                color: RARITY_COLORS[equippedWeapon.rarity],
                backgroundColor: `${RARITY_COLORS[equippedWeapon.rarity]}15`,
                border: `1px solid ${RARITY_COLORS[equippedWeapon.rarity]}30`,
              }}
            >
              {equippedWeapon.emoji} {equippedWeapon.name}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{
                color: RARITY_COLORS[equippedSkin.rarity],
                backgroundColor: `${RARITY_COLORS[equippedSkin.rarity]}15`,
                border: `1px solid ${RARITY_COLORS[equippedSkin.rarity]}30`,
              }}
            >
              {equippedSkin.name} Skin
            </span>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            {unlockedWeaponIds.size}/{WEAPONS.length} weapons {'\u00B7'} {unlockedSkinIds.size}/{ROBOT_SKINS.length} skins unlocked
          </p>
        </div>
      </Card>

      {/* Tab selector */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] w-fit">
        <button
          className={cn(
            'px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer',
            tab === 'weapons'
              ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
          )}
          onClick={() => setTab('weapons')}
        >
          Weapons ({WEAPONS.length})
        </button>
        <button
          className={cn(
            'px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer',
            tab === 'skins'
              ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
          )}
          onClick={() => setTab('skins')}
        >
          Skins ({ROBOT_SKINS.length})
        </button>
      </div>

      {/* Weapons grid */}
      {tab === 'weapons' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)] font-[var(--font-display)]">
              Weapons
            </h2>
            <span className="text-xs text-[var(--text-tertiary)]">
              {unlockedWeaponIds.size} / {WEAPONS.length} unlocked
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {WEAPONS.map((weapon) => {
              const isUnlocked = unlockedWeaponIds.has(weapon.id);
              const isEquipped = equippedWeaponId === weapon.id;
              const progress = getUnlockProgress(weapon, stats);

              return (
                <WeaponCard
                  key={weapon.id}
                  weapon={weapon}
                  isUnlocked={isUnlocked}
                  isEquipped={isEquipped}
                  progress={progress}
                  onEquip={() => handleEquipWeapon(weapon.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Skins grid */}
      {tab === 'skins' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)] font-[var(--font-display)]">
              Robot Skins
            </h2>
            <span className="text-xs text-[var(--text-tertiary)]">
              {unlockedSkinIds.size} / {ROBOT_SKINS.length} unlocked
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ROBOT_SKINS.map((skin) => {
              const isUnlocked = unlockedSkinIds.has(skin.id);
              const isEquipped = equippedSkinId === skin.id;
              const progress = getSkinUnlockProgress(skin, stats);

              return (
                <SkinCard
                  key={skin.id}
                  skin={skin}
                  isUnlocked={isUnlocked}
                  isEquipped={isEquipped}
                  progress={progress}
                  onEquip={() => handleEquipSkin(skin.id)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
