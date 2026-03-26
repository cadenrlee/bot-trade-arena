'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  BATTLE_PASS_TIERS, SEASON_NAME, SEASON_END,
  getBattlePassState, getXPForCurrentLevel, purchaseBattlePass,
} from '@/lib/battlepass';
import { RARITY_COLORS } from '@/lib/weapons';

export default function BattlePassPage() {
  const [state, setState] = useState(getBattlePassState());
  const [justPurchased, setJustPurchased] = useState(false);

  useEffect(() => { setState(getBattlePassState()); }, []);

  const xpInfo = getXPForCurrentLevel();
  const daysLeft = Math.max(0, Math.ceil((SEASON_END.getTime() - Date.now()) / 86400000));

  const handlePurchase = () => {
    purchaseBattlePass();
    setState(getBattlePassState());
    setJustPurchased(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-black font-[var(--font-display)]" style={{
          background: 'linear-gradient(135deg, #6366F1, #F59E0B)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Battle Pass
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{SEASON_NAME}</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{daysLeft} days remaining</p>
      </div>

      {/* Current progress */}
      <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-black font-[var(--font-mono)]">Tier {state.level}</span>
          <span className="text-sm font-[var(--font-mono)] text-[var(--text-secondary)]">{xpInfo.current} / {xpInfo.needed} XP</span>
        </div>
        <div className="h-3 rounded-full bg-[var(--bg-primary)] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple)]"
            style={{ width: `${(xpInfo.current / xpInfo.needed) * 100}%` }} />
        </div>
      </div>

      {/* Premium purchase */}
      {!state.hasPremium && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl text-center border-2 border-[var(--accent-purple)]/30"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(99,102,241,0.05))' }}
        >
          <h2 className="text-xl font-black mb-2">Upgrade to Premium</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Unlock exclusive weapons, skins, effects, and 2x credits at every tier.
          </p>
          <Button onClick={handlePurchase} size="lg" className="text-lg px-10">
            Get Battle Pass — $4.99
          </Button>
        </motion.div>
      )}

      {justPurchased && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-xl bg-[var(--accent-purple)]/10 border border-[var(--accent-purple)]/30 text-center">
          <p className="text-lg font-bold text-[var(--accent-purple)]">Battle Pass Activated!</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">All premium rewards are now unlocked. Keep battling to claim them!</p>
        </motion.div>
      )}

      {/* Tier list */}
      <div className="space-y-2">
        {BATTLE_PASS_TIERS.map((tier, i) => {
          const reached = state.level >= tier.level;
          const isCurrent = state.level === tier.level;

          return (
            <motion.div
              key={tier.level}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                isCurrent ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo)]/5' :
                reached ? 'border-[var(--border-default)] bg-[var(--bg-secondary)]' :
                'border-[var(--border-default)] bg-[var(--bg-secondary)] opacity-50'
              }`}
            >
              {/* Level number */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black font-[var(--font-mono)] ${
                reached ? 'bg-[var(--accent-indigo)] text-white' : 'bg-[var(--bg-primary)] text-[var(--text-tertiary)]'
              }`}>
                {reached ? '✓' : tier.level}
              </div>

              {/* Free reward */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{tier.freeReward?.name || '—'}</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">Free</p>
              </div>

              {/* Premium reward */}
              <div className="flex-1 min-w-0 text-right">
                <p className={`text-xs font-bold truncate ${state.hasPremium ? '' : 'text-[var(--text-tertiary)]'}`}>
                  {state.hasPremium ? '' : '🔒 '}{tier.premiumReward?.name || '—'}
                </p>
                <p className="text-[10px] text-[var(--accent-purple)]">Premium</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="text-center pt-4">
        <Link href="/"><Button size="lg">⚔️ Battle to earn XP</Button></Link>
      </div>
    </div>
  );
}
