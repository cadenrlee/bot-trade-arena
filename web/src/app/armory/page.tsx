'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  WEAPONS, ROBOT_SKINS, RARITY_COLORS,
  getPlayerStats, getUnlockedWeapons, getUnlockedSkins,
  getEquippedWeapon, getEquippedSkin, equipWeapon, equipSkin,
  type PlayerStats,
} from '@/lib/weapons';

export default function ArmoryPage() {
  const [stats, setStats] = useState<PlayerStats>({ totalWins: 0, totalMatches: 0, winStreak: 0, longestStreak: 0, totalTrades: 0 });
  const [equipped, setEquipped] = useState({ weapon: 'fist', skin: 'default' });
  const [tab, setTab] = useState<'weapons' | 'skins'>('weapons');

  useEffect(() => {
    setStats(getPlayerStats());
    setEquipped({ weapon: getEquippedWeapon(), skin: getEquippedSkin() });
  }, []);

  const unlockedWeapons = getUnlockedWeapons(stats);
  const unlockedSkins = getUnlockedSkins(stats);
  const unlockedWeaponIds = new Set(unlockedWeapons.map(w => w.id));
  const unlockedSkinIds = new Set(unlockedSkins.map(s => s.id));

  const handleEquipWeapon = (id: string) => {
    equipWeapon(id);
    setEquipped(e => ({ ...e, weapon: id }));
  };

  const handleEquipSkin = (id: string) => {
    equipSkin(id);
    setEquipped(e => ({ ...e, skin: id }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-black font-[var(--font-display)]">
          <span style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Armory
          </span>
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Unlock weapons and skins by winning battles</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 text-center">
        {[
          { label: 'Wins', value: stats.totalWins },
          { label: 'Matches', value: stats.totalMatches },
          { label: 'Streak', value: stats.winStreak, icon: '🔥' },
          { label: 'Best Streak', value: stats.longestStreak, icon: '⭐' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase">{s.label}</p>
            <p className="text-xl font-black font-[var(--font-mono)]">{s.icon || ''}{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-xl p-1 border border-[var(--border-default)]">
        {(['weapons', 'skins'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer capitalize ${
            tab === t ? 'bg-[var(--accent-indigo)] text-white' : 'text-[var(--text-secondary)]'
          }`}>{t} ({t === 'weapons' ? WEAPONS.length : ROBOT_SKINS.length})</button>
        ))}
      </div>

      {/* Weapons */}
      {tab === 'weapons' && (
        <div className="grid grid-cols-2 gap-3">
          {WEAPONS.map((w, i) => {
            const unlocked = unlockedWeaponIds.has(w.id);
            const isEquipped = equipped.weapon === w.id;
            return (
              <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className={`relative p-4 rounded-xl border transition-all ${
                  isEquipped ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo)]/5' :
                  unlocked ? 'border-[var(--border-default)] bg-[var(--bg-secondary)]' :
                  'border-[var(--border-default)] bg-[var(--bg-secondary)] opacity-50'
                }`}>
                  {isEquipped && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold bg-[var(--accent-indigo)] text-white px-2 py-0.5 rounded-full">EQUIPPED</span>
                  )}
                  <div className="text-center mb-2">
                    <span className="text-3xl">{unlocked ? w.emoji : '🔒'}</span>
                  </div>
                  <p className="font-bold text-sm text-center">{w.name}</p>
                  <p className="text-[10px] text-center font-bold mt-0.5" style={{ color: RARITY_COLORS[w.rarity] }}>
                    {w.rarity.toUpperCase()}
                  </p>
                  <p className="text-[11px] text-[var(--text-tertiary)] text-center mt-1">{w.description}</p>

                  {unlocked && !isEquipped && (
                    <button onClick={() => handleEquipWeapon(w.id)}
                      className="w-full mt-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-indigo)] text-white cursor-pointer hover:opacity-90 transition-opacity">
                      Equip
                    </button>
                  )}
                  {!unlocked && (
                    <p className="text-[10px] text-center mt-2 text-[var(--text-tertiary)]">
                      🔒 {w.unlockRequirement}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Skins */}
      {tab === 'skins' && (
        <div className="grid grid-cols-2 gap-3">
          {ROBOT_SKINS.map((s, i) => {
            const unlocked = unlockedSkinIds.has(s.id);
            const isEquipped = equipped.skin === s.id;
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className={`relative p-4 rounded-xl border transition-all ${
                  isEquipped ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo)]/5' :
                  unlocked ? 'border-[var(--border-default)] bg-[var(--bg-secondary)]' :
                  'border-[var(--border-default)] bg-[var(--bg-secondary)] opacity-50'
                }`}>
                  {isEquipped && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold bg-[var(--accent-indigo)] text-white px-2 py-0.5 rounded-full">EQUIPPED</span>
                  )}
                  <div className="flex justify-center gap-2 mb-2">
                    <div className="w-10 h-10 rounded-full" style={{ background: unlocked ? s.bodyColor : '#374151', boxShadow: unlocked ? `0 0 15px ${s.glowColor}40` : 'none' }} />
                  </div>
                  <p className="font-bold text-sm text-center">{s.name}</p>
                  <p className="text-[10px] text-center font-bold" style={{ color: RARITY_COLORS[s.rarity] }}>{s.rarity.toUpperCase()}</p>

                  {unlocked && !isEquipped && (
                    <button onClick={() => handleEquipSkin(s.id)}
                      className="w-full mt-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-indigo)] text-white cursor-pointer hover:opacity-90">
                      Equip
                    </button>
                  )}
                  {!unlocked && (
                    <p className="text-[10px] text-center mt-2 text-[var(--text-tertiary)]">🔒 {s.unlockRequirement}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Back to battle */}
      <div className="text-center pt-4">
        <Link href="/">
          <Button size="lg">⚔️ Back to Battle</Button>
        </Link>
      </div>
    </div>
  );
}
