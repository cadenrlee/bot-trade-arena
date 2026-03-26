'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { spectatorSocket } from '@/lib/ws';
import { useMatchStore } from '@/stores/match';
import { Card } from '@/components/ui/card';
import { TierBadge } from '@/components/ui/tier-badge';
import { LiveDot } from '@/components/ui/live-dot';
import { Button } from '@/components/ui/button';
import { formatDuration, formatPnl } from '@/lib/utils';

// ============================================================
// ROBOT FIGHTER — Full animated SVG robot with arms, legs, effects
// ============================================================

function Sparks({ active, color, side }: { active: boolean; color: string; side: 'left' | 'right' }) {
  if (!active) return null;
  const particles = Array.from({ length: 8 }, (_, i) => i);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((i) => {
        const angle = (i / 8) * 360;
        const dist = 20 + Math.random() * 25;
        const x = Math.cos((angle * Math.PI) / 180) * dist;
        const y = Math.sin((angle * Math.PI) / 180) * dist;
        const size = 2 + Math.random() * 4;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size, height: size, background: color,
              left: '50%', top: '40%',
              boxShadow: `0 0 ${size * 2}px ${color}`,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x, y, opacity: 0, scale: 0 }}
            transition={{ duration: 0.5 + Math.random() * 0.3, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

function Robot({ side, action, color, pnl }: { side: 'left' | 'right'; action: string; color: string; pnl: number }) {
  const isHit = action === 'hit';
  const isAttack = action === 'attack';
  const isWin = action === 'win';
  const isLose = action === 'lose';
  const faceColor = isHit ? '#EF4444' : isWin ? '#22C55E' : color;
  const glow = isAttack ? `0 0 30px ${color}` : isWin ? `0 0 40px ${color}` : 'none';
  const mirror = side === 'right' ? -1 : 1;

  return (
    <motion.div
      className="relative"
      animate={
        action === 'idle' ? { y: [0, -8, 0] } :
        isAttack ? { x: [0, 50 * mirror, 0], rotate: [0, 10 * mirror, 0] } :
        isHit ? { x: [0, -20 * mirror, 0], rotate: [0, -8 * mirror, 0] } :
        isWin ? { y: [0, -18, 0], scale: [1, 1.1, 1] } :
        isLose ? { opacity: 0.35, scale: 0.85, y: 10 } :
        {}
      }
      transition={
        action === 'idle' ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } :
        isWin ? { duration: 0.7, repeat: Infinity, ease: 'easeInOut' } :
        { duration: 0.4, ease: 'easeOut' }
      }
    >
      {/* Energy glow behind robot */}
      {(isAttack || isWin) && (
        <motion.div
          className="absolute rounded-full blur-xl"
          style={{ background: color, width: 80, height: 80, left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0.3, 0.1], scale: [0.8, 1.2] }}
          transition={{ duration: 0.5 }}
        />
      )}

      {/* Hit sparks */}
      <Sparks active={isHit} color="#EF4444" side={side} />
      {isAttack && <Sparks active={true} color={color} side={side} />}

      <svg width="90" height="120" viewBox="0 0 90 120" style={{ filter: `drop-shadow(${glow})` }}>
        {/* Antenna */}
        <motion.line x1="45" y1="8" x2="45" y2="18" stroke={color} strokeWidth="3" strokeLinecap="round"
          animate={isWin ? { y1: [8, 3, 8] } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
        <motion.circle cx="45" cy="5" r="4" fill={color}
          animate={isWin ? { r: [4, 5, 4], opacity: [1, 0.6, 1] } : isAttack ? { r: [4, 6, 4] } : {}}
          transition={{ duration: 0.4 }}
        />

        {/* Head */}
        <rect x="22" y="18" width="46" height="36" rx="10" fill={isHit ? 'rgba(239,68,68,0.2)' : `color-mix(in srgb, ${color} 12%, #111827)`} stroke={isHit ? '#EF4444' : color} strokeWidth="2" opacity={isLose ? 0.5 : 1} />

        {/* Eyes */}
        <motion.circle cx="36" cy="32" r={isHit ? 2 : 4} fill={faceColor}
          animate={isHit ? { cy: [32, 34, 32], r: [4, 2, 4] } : isAttack ? { r: [4, 5, 4] } : {}}
        />
        <motion.circle cx="54" cy="32" r={isHit ? 2 : 4} fill={faceColor}
          animate={isHit ? { cy: [32, 34, 32], r: [4, 2, 4] } : isAttack ? { r: [4, 5, 4] } : {}}
        />
        {/* Eye shine */}
        <circle cx="34" cy="30" r="1.5" fill="white" opacity="0.6" />
        <circle cx="52" cy="30" r="1.5" fill="white" opacity="0.6" />

        {/* Mouth */}
        {isWin ? (
          <path d="M 36 42 Q 45 50 54 42" stroke="#22C55E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        ) : isHit ? (
          <path d="M 36 46 Q 45 40 54 46" stroke="#EF4444" strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : isAttack ? (
          <circle cx="45" cy="44" r="3" fill={color} opacity="0.7" />
        ) : (
          <line x1="38" y1="44" x2="52" y2="44" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        )}

        {/* Body */}
        <rect x="27" y="56" width="36" height="30" rx="6" fill={isHit ? 'rgba(239,68,68,0.15)' : `color-mix(in srgb, ${color} 10%, #111827)`} stroke={isHit ? '#EF4444' : color} strokeWidth="1.5" opacity={isLose ? 0.5 : 1} />
        {/* Body detail — power core */}
        <motion.circle cx="45" cy="71" r="5" fill={color} opacity={0.3}
          animate={isAttack ? { opacity: [0.3, 0.8, 0.3], r: [5, 7, 5] } : isWin ? { opacity: [0.3, 0.6, 0.3] } : {}}
          transition={{ duration: 0.5 }}
        />
        <circle cx="45" cy="71" r="2" fill={color} opacity="0.6" />

        {/* Left arm */}
        <motion.g
          animate={
            isAttack && side === 'left' ? { rotate: [0, -45, 0], x: [0, 10, 0] } :
            isAttack && side === 'right' ? { rotate: [0, 20, 0] } :
            isHit ? { rotate: [0, 15, 0] } :
            action === 'idle' ? { rotate: [0, -3, 0] } : {}
          }
          transition={{ duration: isAttack ? 0.3 : 1.5, repeat: action === 'idle' ? Infinity : 0 }}
          style={{ transformOrigin: '27px 62px' }}
        >
          <rect x="8" y="58" width="19" height="8" rx="4" fill={color} opacity={isLose ? 0.4 : 0.7} />
          {/* Fist */}
          <circle cx="10" cy="62" r="5" fill={isAttack ? color : `color-mix(in srgb, ${color} 70%, #111827)`} />
        </motion.g>

        {/* Right arm */}
        <motion.g
          animate={
            isAttack && side === 'right' ? { rotate: [0, 45, 0], x: [0, -10, 0] } :
            isAttack && side === 'left' ? { rotate: [0, -20, 0] } :
            isHit ? { rotate: [0, -15, 0] } :
            action === 'idle' ? { rotate: [0, 3, 0] } : {}
          }
          transition={{ duration: isAttack ? 0.3 : 1.5, repeat: action === 'idle' ? Infinity : 0 }}
          style={{ transformOrigin: '63px 62px' }}
        >
          <rect x="63" y="58" width="19" height="8" rx="4" fill={color} opacity={isLose ? 0.4 : 0.7} />
          <circle cx="80" cy="62" r="5" fill={isAttack ? color : `color-mix(in srgb, ${color} 70%, #111827)`} />
        </motion.g>

        {/* Legs */}
        <motion.rect x="32" y="87" width="10" height="18" rx="4" fill={color} opacity={isLose ? 0.3 : 0.5}
          animate={action === 'idle' ? { height: [18, 16, 18] } : isWin ? { height: [18, 14, 18] } : {}}
          transition={{ duration: action === 'idle' ? 1.8 : 0.7, repeat: Infinity }}
        />
        <motion.rect x="48" y="87" width="10" height="18" rx="4" fill={color} opacity={isLose ? 0.3 : 0.5}
          animate={action === 'idle' ? { height: [16, 18, 16] } : isWin ? { height: [14, 18, 14] } : {}}
          transition={{ duration: action === 'idle' ? 1.8 : 0.7, repeat: Infinity }}
        />
        {/* Feet */}
        <rect x="29" y="103" width="16" height="6" rx="3" fill={color} opacity={isLose ? 0.3 : 0.4} />
        <rect x="45" y="103" width="16" height="6" rx="3" fill={color} opacity={isLose ? 0.3 : 0.4} />
      </svg>

      {/* P&L badge under robot */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
        <div className="px-2 py-0.5 rounded-full text-[10px] font-bold font-[var(--font-mono)]" style={{
          background: pnl >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          color: pnl >= 0 ? '#10B981' : '#EF4444',
          border: `1px solid ${pnl >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
        </div>
      </div>
    </motion.div>
  );
}

function DamageNumber({ value, side, isCrit }: { value: string; side: 'left' | 'right'; isCrit?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: isCrit ? 1.5 : 1 }}
      animate={{ opacity: 0, y: -40, scale: isCrit ? 2 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9 }}
      className="absolute font-black font-[var(--font-mono)] z-10"
      style={{
        color: isCrit ? '#F59E0B' : '#EF4444',
        fontSize: isCrit ? 18 : 14,
        textShadow: isCrit ? '0 0 10px #F59E0B' : '0 0 6px rgba(239,68,68,0.5)',
        left: '50%', transform: 'translateX(-50%)', top: -15,
      }}
    >
      {isCrit && 'CRIT! '}{value}
    </motion.div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function MatchSpectatorPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const {
    matchData, currentTick, trades, pnlHistory, spectatorCount,
    setActiveMatch, updateTick, addTrade, setSpectatorCount, clearMatch,
  } = useMatchStore();

  const [loading, setLoading] = useState(true);
  const [matchOver, setMatchOver] = useState(false);
  const [prediction, setPrediction] = useState<'bot1' | 'bot2' | null>(null);
  const tradeFeedRef = useRef<HTMLDivElement>(null);

  // Robot battle state
  const [bot1Action, setBot1Action] = useState('idle');
  const [bot2Action, setBot2Action] = useState('idle');
  const [dmg1, setDmg1] = useState<string | null>(null);
  const [dmg2, setDmg2] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [combo, setCombo] = useState(0);

  // React to trades for robot animations
  const lastTradeCount = useRef(0);
  useEffect(() => {
    if (trades.length <= lastTradeCount.current) return;
    lastTradeCount.current = trades.length;
    const trade = trades[trades.length - 1];
    if (!trade || !matchData) return;

    const isBot1 = trade.botId === matchData.bot1?.id || trade.botId === matchData.bot1Id;
    const isClose = trade.type === 'CLOSE';
    const isWin = trade.pnl != null && trade.pnl > 0;
    const isBig = Math.abs(trade.pnl || 0) > 30;

    if (isClose) {
      if (isBot1 && isWin) {
        setBot1Action('attack'); setBot2Action('hit');
        setDmg2(`-$${Math.abs(trade.pnl || 0).toFixed(0)}`);
        setCombo(c => c + 1);
      } else if (isBot1 && !isWin) {
        setBot1Action('hit'); setBot2Action('attack');
        setDmg1(`-$${Math.abs(trade.pnl || 0).toFixed(0)}`);
        setCombo(0);
      } else if (!isBot1 && isWin) {
        setBot2Action('attack'); setBot1Action('hit');
        setDmg1(`-$${Math.abs(trade.pnl || 0).toFixed(0)}`);
      } else {
        setBot2Action('hit'); setBot1Action('attack');
        setDmg2(`-$${Math.abs(trade.pnl || 0).toFixed(0)}`);
      }
      if (isBig) setShake(true);
    }

    const timer = setTimeout(() => {
      setBot1Action(matchOver ? 'idle' : 'idle');
      setBot2Action(matchOver ? 'idle' : 'idle');
      setDmg1(null); setDmg2(null); setShake(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [trades.length]);

  // Match over — set winner animations
  useEffect(() => {
    if (!matchOver || !matchData) return;
    const w = matchData.winnerId;
    setBot1Action(w === matchData.bot1Id ? 'win' : w === matchData.bot2Id ? 'lose' : 'idle');
    setBot2Action(w === matchData.bot2Id ? 'win' : w === matchData.bot1Id ? 'lose' : 'idle');
  }, [matchOver, matchData]);

  // Fetch + poll
  useEffect(() => {
    let mounted = true;
    let pollTimer: ReturnType<typeof setInterval>;

    async function fetchMatch() {
      try {
        const data = await api.getMatch(matchId);
        if (!mounted) return;
        setActiveMatch(matchId, data);
        setLoading(false);
        if (data.status === 'COMPLETED') {
          setMatchOver(true);
          updateTick({
            elapsed: data.duration || 300, remaining: 0, prices: {},
            bot1: { botId: data.bot1?.id || '', pnl: data.bot1Pnl || 0, totalCapital: 100000 + (data.bot1Pnl || 0), trades: data.bot1Trades || 0, wins: 0, losses: 0, winRate: data.bot1WinRate || 0, openPositions: 0 },
            bot2: { botId: data.bot2?.id || '', pnl: data.bot2Pnl || 0, totalCapital: 100000 + (data.bot2Pnl || 0), trades: data.bot2Trades || 0, wins: 0, losses: 0, winRate: data.bot2WinRate || 0, openPositions: 0 },
          });
        }
      } catch { if (mounted) setLoading(false); }
    }

    fetchMatch();
    pollTimer = setInterval(() => {
      if (!mounted || matchOver) return;
      api.getMatch(matchId).then((data) => {
        if (!mounted) return;
        if (data.status === 'COMPLETED') {
          setMatchOver(true);
          updateTick({
            elapsed: data.duration || 300, remaining: 0, prices: {},
            bot1: { botId: data.bot1?.id || '', pnl: data.bot1Pnl || 0, totalCapital: 100000 + (data.bot1Pnl || 0), trades: data.bot1Trades || 0, wins: 0, losses: 0, winRate: data.bot1WinRate || 0, openPositions: 0 },
            bot2: { botId: data.bot2?.id || '', pnl: data.bot2Pnl || 0, totalCapital: 100000 + (data.bot2Pnl || 0), trades: data.bot2Trades || 0, wins: 0, losses: 0, winRate: data.bot2WinRate || 0, openPositions: 0 },
          });
        }
      }).catch(() => {});
    }, 2000);

    try { spectatorSocket.connect(); spectatorSocket.subscribeMatch(matchId); } catch {}
    const off1 = spectatorSocket.on('match:tick', (d) => { if (mounted) updateTick(d); });
    const off2 = spectatorSocket.on('match:trade', (d) => { if (mounted) addTrade(d); });
    const off3 = spectatorSocket.on('match:spectators', (d) => { if (mounted) setSpectatorCount(d.count); });
    const off4 = spectatorSocket.on('match:end', () => { if (mounted) setMatchOver(true); });

    return () => { mounted = false; clearInterval(pollTimer); spectatorSocket.unsubscribeMatch(matchId); off1(); off2(); off3(); off4(); clearMatch(); };
  }, [matchId]);

  useEffect(() => {
    if (tradeFeedRef.current) tradeFeedRef.current.scrollTop = tradeFeedRef.current.scrollHeight;
  }, [trades]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
        <svg className="h-10 w-10 text-[var(--accent-indigo)]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </motion.div>
    </div>
  );

  if (!matchData) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-[var(--text-secondary)]">Match not found.</p>
      <Button variant="secondary" onClick={() => window.history.back()}>Go Back</Button>
    </div>
  );

  const bot1 = matchData.bot1 || { name: 'Bot 1', elo: 1000 };
  const bot2 = matchData.bot2 || { name: 'Bot 2', elo: 1000 };
  const bot1Pnl = currentTick?.bot1?.pnl ?? matchData.bot1Pnl ?? 0;
  const bot2Pnl = currentTick?.bot2?.pnl ?? matchData.bot2Pnl ?? 0;
  const bot1Trades = currentTick?.bot1?.trades ?? matchData.bot1Trades ?? 0;
  const bot2Trades = currentTick?.bot2?.trades ?? matchData.bot2Trades ?? 0;
  const totalPnl = Math.abs(bot1Pnl) + Math.abs(bot2Pnl) || 1;
  const bot1BarPct = Math.max(8, Math.min(92, ((bot1Pnl + totalPnl) / (2 * totalPnl)) * 100));
  const remaining = currentTick?.remaining ?? matchData.duration ?? 0;
  const elapsed = currentTick?.elapsed ?? 0;
  const duration = matchData.duration || 300;
  const isCompleted = matchOver || matchData.status === 'COMPLETED';
  const isRunning = matchData.status === 'RUNNING' && !matchOver;
  const winnerId = matchData.winnerId;
  const bot1Score = matchData.bot1Score;
  const bot2Score = matchData.bot2Score;
  const bot1PnlPct = (bot1Pnl / 100000) * 100;
  const bot2PnlPct = (bot2Pnl / 100000) * 100;

  return (
    <div className={`min-h-screen px-4 py-6 sm:px-6 lg:px-8 ${shake ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}>
      <style jsx>{`@keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }`}</style>
      <div className="mx-auto max-w-5xl space-y-5">

        {/* ============ ROBOT BATTLE ARENA ============ */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card hover={false} className="p-6 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 opacity-5" style={{
              background: `radial-gradient(ellipse at 25% 50%, var(--accent-indigo), transparent 50%), radial-gradient(ellipse at 75% 50%, var(--accent-emerald), transparent 50%)`,
            }} />

            {/* Timer bar */}
            <div className="relative flex items-center gap-3 mb-4">
              {isRunning && <LiveDot />}
              <span className="text-xs font-[var(--font-mono)] text-[var(--text-tertiary)]">{formatDuration(elapsed)}</span>
              <div className="flex-1 h-1 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple)]"
                  animate={{ width: `${duration > 0 ? (elapsed / duration) * 100 : 0}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-sm font-[var(--font-mono)] font-bold text-[var(--text-primary)]">{formatDuration(remaining)}</span>
              {matchData.tier && <TierBadge tier={matchData.tier} size="sm" />}
            </div>

            {/* Health bar */}
            <div className="relative h-7 rounded-full overflow-hidden bg-[var(--bg-primary)] mb-6">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--accent-indigo)] to-indigo-400"
                animate={{ width: `${bot1BarPct}%` }}
                transition={{ duration: 0.5 }}
              />
              <motion.div
                className="absolute inset-y-0 right-0 bg-gradient-to-l from-[var(--accent-emerald)] to-emerald-400"
                animate={{ width: `${100 - bot1BarPct}%` }}
                transition={{ duration: 0.5 }}
              />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
              <div className="absolute inset-0 flex items-center justify-between px-4">
                <span className="text-xs font-bold text-white drop-shadow font-[var(--font-mono)]">
                  {bot1PnlPct >= 0 ? '+' : ''}{bot1PnlPct.toFixed(2)}%
                </span>
                <span className="text-xs font-bold text-white drop-shadow font-[var(--font-mono)]">
                  {bot2PnlPct >= 0 ? '+' : ''}{bot2PnlPct.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Robot battle */}
            <div className="relative flex items-end justify-between px-6 h-40">
              {/* Bot 1 */}
              <div className="relative flex flex-col items-center">
                <AnimatePresence>{dmg1 && <DamageNumber key="d1" value={dmg1} side="left" isCrit={shake} />}</AnimatePresence>
                <Robot side="left" action={bot1Action} color="var(--accent-indigo)" pnl={bot1PnlPct} />
                <p className="mt-2 text-sm font-bold truncate max-w-[100px]">{bot1.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-[var(--font-mono)]" style={{ color: bot1Pnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
                    {formatPnl(bot1Pnl)}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">{bot1Trades}T</span>
                </div>
              </div>

              {/* Center */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                {isCompleted ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                    <span className="text-2xl font-black text-[var(--accent-amber)]">
                      {winnerId ? 'KO!' : 'DRAW'}
                    </span>
                  </motion.div>
                ) : combo >= 3 ? (
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }}>
                    <span className="text-lg font-black text-[var(--accent-amber)]">{combo}x COMBO!</span>
                  </motion.div>
                ) : (
                  <span className="text-lg font-bold text-[var(--text-tertiary)]/30">VS</span>
                )}
              </div>

              {/* Bot 2 */}
              <div className="relative flex flex-col items-center">
                <AnimatePresence>{dmg2 && <DamageNumber key="d2" value={dmg2} side="right" isCrit={shake} />}</AnimatePresence>
                <Robot side="right" action={bot2Action} color="var(--accent-emerald)" pnl={bot2PnlPct} />
                <p className="mt-2 text-sm font-bold truncate max-w-[100px]">{bot2.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-[var(--font-mono)]" style={{ color: bot2Pnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
                    {formatPnl(bot2Pnl)}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">{bot2Trades}T</span>
                </div>
              </div>
            </div>

            {/* Winner = highest % gain */}
            <p className="text-center text-[10px] text-[var(--text-tertiary)] mt-3 font-[var(--font-mono)]">
              WINNER = HIGHEST % GAIN
            </p>
          </Card>
        </motion.div>

        {/* ============ COMPLETED RESULTS ============ */}
        {isCompleted && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card hover={false} className="p-6 text-center">
              <h2 className="text-3xl font-black font-[var(--font-display)] mb-4" style={{
                background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple), var(--accent-emerald))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                {winnerId === matchData.bot1Id ? `${bot1.name} WINS!` :
                 winnerId === matchData.bot2Id ? `${bot2.name} WINS!` : 'DRAW!'}
              </h2>
              <div className="flex justify-center gap-12 mb-6">
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">{bot1.name}</p>
                  <p className="text-3xl font-black font-[var(--font-mono)] text-[var(--accent-indigo)]">{Math.round(bot1Score || 0)}</p>
                  <p className="text-sm font-[var(--font-mono)]" style={{ color: bot1Pnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>{formatPnl(bot1Pnl)}</p>
                </div>
                <div className="self-center text-[var(--text-tertiary)]">vs</div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">{bot2.name}</p>
                  <p className="text-3xl font-black font-[var(--font-mono)] text-[var(--accent-emerald)]">{Math.round(bot2Score || 0)}</p>
                  <p className="text-sm font-[var(--font-mono)]" style={{ color: bot2Pnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>{formatPnl(bot2Pnl)}</p>
                </div>
              </div>
              <div className="flex justify-center gap-3">
                <Button onClick={() => window.location.href = '/matches/live'}>Play Again</Button>
                <Button variant="secondary" onClick={() => window.location.href = `/matches/${matchId}/results`}>Full Breakdown</Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ============ CHART + FEED ============ */}
        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card hover={false} className="h-[320px]">
              <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">P&L Over Time</p>
              {pnlHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="88%">
                  <LineChart data={pnlHistory}>
                    <XAxis dataKey="elapsed" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatDuration(v)} />
                    <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}
                      formatter={(value: any, name: any) => [formatPnl(Number(value)), name === 'bot1' ? bot1.name : bot2.name]}
                    />
                    <Line type="monotone" dataKey="bot1" stroke="var(--accent-indigo)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="bot2" stroke="var(--accent-emerald)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[80%] text-[var(--text-tertiary)] text-sm">
                  {isRunning ? 'Collecting data...' : 'No chart data available'}
                </div>
              )}
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card hover={false} className="flex h-[320px] flex-col">
              <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Trade Feed</p>
              <div ref={tradeFeedRef} className="flex-1 space-y-1 overflow-y-auto pr-1">
                {trades.length === 0 && (
                  <p className="py-8 text-center text-sm text-[var(--text-tertiary)]">
                    {isRunning ? 'Waiting for trades...' : 'No trades recorded'}
                  </p>
                )}
                {trades.slice(-30).map((trade, i) => {
                  const isBot1 = trade.botId === (matchData.bot1?.id || matchData.bot1Id);
                  const botName = isBot1 ? bot1.name : bot2.name;
                  const isClose = trade.type === 'CLOSE';
                  const isProfit = trade.pnl != null && trade.pnl > 0;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 rounded-lg bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{
                        backgroundColor: isClose ? (isProfit ? 'var(--accent-emerald)' : 'var(--accent-red)') : 'var(--accent-indigo)',
                      }} />
                      <span className="font-medium text-[var(--text-primary)] truncate">{botName}</span>
                      <span className="text-[var(--text-tertiary)]">{trade.symbol}</span>
                      {trade.pnl != null && (
                        <span className="ml-auto font-[var(--font-mono)] font-bold" style={{ color: trade.pnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
                          {formatPnl(trade.pnl)}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* ============ BOTTOM BAR ============ */}
        <Card hover={false}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              <span className="font-[var(--font-mono)] text-sm">{spectatorCount} watching</span>
            </div>
            {!isCompleted && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--text-secondary)]">Who wins?</span>
                <Button variant={prediction === 'bot1' ? 'primary' : 'secondary'} size="sm" onClick={() => setPrediction('bot1')}>{bot1.name}</Button>
                <Button
                  variant={prediction === 'bot2' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setPrediction('bot2')}
                  className={prediction === 'bot2' ? 'bg-gradient-to-br from-[var(--accent-emerald)] to-emerald-600' : ''}
                >{bot2.name}</Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
