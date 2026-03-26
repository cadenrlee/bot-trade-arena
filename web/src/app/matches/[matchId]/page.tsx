'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { TierBadge } from '@/components/ui/tier-badge';
import { Button } from '@/components/ui/button';
import { formatPnl } from '@/lib/utils';

// ============================================================
// SPARK PARTICLES
// ============================================================
function Sparks({ color }: { color: string }) {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * 360;
        const dist = 25 + Math.random() * 30;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 3 + Math.random() * 4, height: 3 + Math.random() * 4,
              background: color, left: '50%', top: '40%',
              boxShadow: `0 0 8px ${color}`,
            }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{
              x: Math.cos((angle * Math.PI) / 180) * dist,
              y: Math.sin((angle * Math.PI) / 180) * dist,
              opacity: 0,
            }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        );
      })}
    </>
  );
}

// ============================================================
// ROBOT FIGHTER — Full SVG
// ============================================================
function Robot({ side, action, color, pnlPct }: { side: 'left' | 'right'; action: string; color: string; pnlPct: number }) {
  const isHit = action === 'hit';
  const isAttack = action === 'attack';
  const isWin = action === 'win';
  const isLose = action === 'lose';
  const m = side === 'right' ? -1 : 1;
  const faceColor = isHit ? '#EF4444' : isWin ? '#22C55E' : color;

  return (
    <div className="relative">
      {/* Hit sparks */}
      {isHit && <Sparks color="#EF4444" />}
      {isAttack && <Sparks color={color} />}

      {/* Energy glow */}
      {(isAttack || isWin) && (
        <motion.div
          className="absolute rounded-full blur-2xl"
          style={{ background: color, width: 100, height: 100, left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 0.1] }}
          transition={{ duration: 0.5 }}
        />
      )}

      <motion.div
        animate={
          action === 'idle' ? { y: [0, -10, 0] } :
          isAttack ? { x: [0, 55 * m, 0], rotate: [0, 12 * m, 0] } :
          isHit ? { x: [0, -25 * m, 0], rotate: [0, -8 * m, 0] } :
          isWin ? { y: [0, -20, 0], scale: [1, 1.12, 1] } :
          isLose ? { opacity: 0.3, scale: 0.8, y: 15 } : {}
        }
        transition={
          action === 'idle' ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } :
          isWin ? { duration: 0.6, repeat: Infinity } :
          { duration: 0.35, ease: 'easeOut' }
        }
      >
        <svg width="100" height="130" viewBox="0 0 100 130" style={{ filter: (isAttack || isWin) ? `drop-shadow(0 0 15px ${color})` : 'none' }}>
          {/* Antenna */}
          <line x1="50" y1="8" x2="50" y2="20" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <motion.circle cx="50" cy="5" r="4" fill={color}
            animate={isAttack ? { r: [4, 7, 4], opacity: [1, 0.5, 1] } : isWin ? { r: [4, 6, 4] } : {}}
            transition={{ duration: 0.4, repeat: isWin ? Infinity : 0 }}
          />

          {/* Head */}
          <rect x="24" y="20" width="52" height="38" rx="12" fill={isHit ? 'rgba(239,68,68,0.2)' : '#1a1a2e'} stroke={isHit ? '#EF4444' : color} strokeWidth="2.5" />
          {/* Eyes */}
          <motion.circle cx="38" cy="35" r={isHit ? 2 : 5} fill={faceColor}
            animate={isHit ? { r: [5, 2, 5] } : isAttack ? { r: [5, 7, 5] } : {}}
          />
          <motion.circle cx="62" cy="35" r={isHit ? 2 : 5} fill={faceColor}
            animate={isHit ? { r: [5, 2, 5] } : isAttack ? { r: [5, 7, 5] } : {}}
          />
          <circle cx="36" cy="33" r="2" fill="white" opacity="0.5" />
          <circle cx="60" cy="33" r="2" fill="white" opacity="0.5" />
          {/* Mouth */}
          {isWin ? <path d="M 38 46 Q 50 55 62 46" stroke="#22C55E" strokeWidth="3" fill="none" strokeLinecap="round" />
           : isHit ? <path d="M 38 50 Q 50 43 62 50" stroke="#EF4444" strokeWidth="2" fill="none" strokeLinecap="round" />
           : isAttack ? <ellipse cx="50" cy="47" rx="4" ry="3" fill={color} opacity="0.8" />
           : <line x1="40" y1="48" x2="60" y2="48" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          }

          {/* Body */}
          <rect x="30" y="60" width="40" height="34" rx="8" fill="#1a1a2e" stroke={isHit ? '#EF4444' : color} strokeWidth="2" />
          {/* Power core */}
          <motion.circle cx="50" cy="77" r="6" fill={color} opacity={0.25}
            animate={isAttack ? { opacity: [0.25, 0.9, 0.25], r: [6, 9, 6] } : {}}
          />
          <circle cx="50" cy="77" r="3" fill={color} opacity="0.7" />

          {/* Left arm */}
          <motion.g style={{ transformOrigin: '30px 66px' }}
            animate={
              isAttack && side === 'left' ? { rotate: [0, -60, 0] } :
              isAttack ? { rotate: [0, 25, 0] } :
              isHit ? { rotate: [0, 20, 0] } :
              action === 'idle' ? { rotate: [0, -4, 0, 4, 0] } : {}
            }
            transition={{ duration: isAttack ? 0.25 : 2, repeat: action === 'idle' ? Infinity : 0 }}
          >
            <rect x="6" y="62" width="24" height="10" rx="5" fill={color} opacity="0.7" />
            <circle cx="8" cy="67" r="6" fill={isAttack ? color : '#1a1a2e'} stroke={color} strokeWidth="2" />
          </motion.g>

          {/* Right arm */}
          <motion.g style={{ transformOrigin: '70px 66px' }}
            animate={
              isAttack && side === 'right' ? { rotate: [0, 60, 0] } :
              isAttack ? { rotate: [0, -25, 0] } :
              isHit ? { rotate: [0, -20, 0] } :
              action === 'idle' ? { rotate: [0, 4, 0, -4, 0] } : {}
            }
            transition={{ duration: isAttack ? 0.25 : 2, repeat: action === 'idle' ? Infinity : 0 }}
          >
            <rect x="70" y="62" width="24" height="10" rx="5" fill={color} opacity="0.7" />
            <circle cx="92" cy="67" r="6" fill={isAttack ? color : '#1a1a2e'} stroke={color} strokeWidth="2" />
          </motion.g>

          {/* Legs */}
          <motion.rect x="35" y="95" width="11" height="22" rx="5" fill={color} opacity="0.5"
            animate={action === 'idle' ? { height: [22, 18, 22] } : isWin ? { height: [22, 14, 22] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.rect x="54" y="95" width="11" height="22" rx="5" fill={color} opacity="0.5"
            animate={action === 'idle' ? { height: [18, 22, 18] } : isWin ? { height: [14, 22, 14] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <rect x="32" y="115" width="17" height="7" rx="3.5" fill={color} opacity="0.35" />
          <rect x="51" y="115" width="17" height="7" rx="3.5" fill={color} opacity="0.35" />
        </svg>
      </motion.div>

      {/* P&L badge */}
      <div className="text-center mt-1">
        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold font-[var(--font-mono)]" style={{
          background: pnlPct >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          color: pnlPct >= 0 ? '#10B981' : '#EF4444',
        }}>
          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

// ============================================================
// CLIENT-SIDE MATCH SIMULATION
// ============================================================
interface SimBot {
  name: string; pnl: number; trades: number; wins: number; losses: number;
  positions: { symbol: string; side: string; entry: number; id: string }[];
  cash: number;
}

function simulateTick(bot: SimBot, prices: Record<string, number>, strategy: 'momentum' | 'reversion'): { action?: string; pnl?: number; symbol?: string } {
  const symbols = Object.keys(prices);
  if (symbols.length === 0) return {};
  const sym = symbols[Math.floor(Math.random() * symbols.length)];
  const price = prices[sym];
  if (!price) return {};

  // Close existing positions sometimes
  if (bot.positions.length > 0 && Math.random() < 0.15) {
    const pos = bot.positions[0];
    const exitPnl = pos.side === 'LONG' ? (price - pos.entry) * 100 : (pos.entry - price) * 100;
    bot.positions.shift();
    bot.pnl += exitPnl;
    bot.cash += Math.abs(exitPnl);
    bot.trades++;
    if (exitPnl > 0) bot.wins++; else bot.losses++;
    return { action: 'CLOSE', pnl: exitPnl, symbol: pos.symbol };
  }

  // Open new positions
  if (bot.positions.length < 3 && Math.random() < (strategy === 'momentum' ? 0.08 : 0.06)) {
    const side = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    bot.positions.push({ symbol: sym, side, entry: price, id: `p${bot.trades}` });
    return { action: 'OPEN', symbol: sym };
  }

  return {};
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function MatchSpectatorPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState<any>(null);

  // Simulation state
  const [elapsed, setElapsed] = useState(0);
  const [duration] = useState(120); // 2 min visual match
  const [matchOver, setMatchOver] = useState(false);
  const [bot1, setBot1] = useState<SimBot>({ name: 'Your Bot', pnl: 0, trades: 0, wins: 0, losses: 0, positions: [], cash: 100000 });
  const [bot2, setBot2] = useState<SimBot>({ name: 'Opponent', pnl: 0, trades: 0, wins: 0, losses: 0, positions: [], cash: 100000 });
  const [prices, setPrices] = useState<Record<string, number>>({ BTCUSDT: 67500, ETHUSDT: 3200, SOLUSDT: 145 });
  const [trades, setTrades] = useState<any[]>([]);

  // Robot state
  const [bot1Action, setBot1Action] = useState('idle');
  const [bot2Action, setBot2Action] = useState('idle');
  const [dmg1, setDmg1] = useState<string | null>(null);
  const [dmg2, setDmg2] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [combo, setCombo] = useState(0);
  const [prediction, setPrediction] = useState<1 | 2 | null>(null);
  const [commentary, setCommentary] = useState('Bots are entering the arena...');

  const tradeFeedRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Fetch match data
  useEffect(() => {
    api.getMatch(matchId).then((data) => {
      setMatchData(data);
      const b1Name = data.bot1?.name || 'Your Bot';
      const b2Name = data.bot2?.name || 'Opponent';
      setBot1(b => ({ ...b, name: b1Name }));
      setBot2(b => ({ ...b, name: b2Name }));
      setLoading(false);

      // If match already completed, show results immediately
      if (data.status === 'COMPLETED') {
        setMatchOver(true);
        setElapsed(data.duration || 120);
        setBot1(b => ({ ...b, pnl: data.bot1Pnl || 0, trades: data.bot1Trades || 0 }));
        setBot2(b => ({ ...b, pnl: data.bot2Pnl || 0, trades: data.bot2Trades || 0 }));
      }
    }).catch(() => setLoading(false));
  }, [matchId]);

  // Run client-side simulation
  useEffect(() => {
    if (loading || matchOver || !matchData || matchData.status === 'COMPLETED') return;

    const commentaries = [
      '{b1} opens aggressively!', '{b2} is reading the market...', 'Both bots are trading cautiously.',
      '{b1} lands a profitable trade!', '{b2} takes a hit!', 'The tension is building!',
      '{b1} is on fire!', '{b2} fights back!', 'Critical moment approaching!',
      'The crowd goes wild!', 'Incredible trading from both sides!', '{b1} smells blood!',
      '{b2} is mounting a comeback!', 'This could go either way!', 'Final stretch!',
    ];

    simRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        if (next >= duration) {
          clearInterval(simRef.current);
          setMatchOver(true);
          return duration;
        }
        return next;
      });

      // Update prices (random walk)
      setPrices(prev => {
        const next = { ...prev };
        for (const sym of Object.keys(next)) {
          next[sym] *= (1 + (Math.random() - 0.5) * 0.001);
          next[sym] = Math.round(next[sym] * 100) / 100;
        }
        return next;
      });

      // Simulate bot trading
      setBot1(prev => {
        const b = { ...prev, positions: [...prev.positions] };
        const result = simulateTick(b, prices, 'momentum');
        if (result.action === 'CLOSE' && result.pnl != null) {
          const isWin = result.pnl > 0;
          const isBig = Math.abs(result.pnl) > 20;
          setTrades(t => [...t.slice(-25), { bot: 1, ...result, time: Date.now() }]);
          if (isWin) {
            setBot1Action('attack'); setBot2Action('hit');
            setDmg2(formatPnl(result.pnl)); setCombo(c => c + 1);
            if (isBig) setShake(true);
          } else {
            setBot1Action('hit'); setBot2Action('attack');
            setDmg1(formatPnl(result.pnl)); setCombo(0);
          }
          setTimeout(() => { setBot1Action('idle'); setBot2Action('idle'); setDmg1(null); setDmg2(null); setShake(false); }, 500);
        }
        return b;
      });

      setBot2(prev => {
        const b = { ...prev, positions: [...prev.positions] };
        const result = simulateTick(b, prices, 'reversion');
        if (result.action === 'CLOSE' && result.pnl != null) {
          const isWin = result.pnl > 0;
          setTrades(t => [...t.slice(-25), { bot: 2, ...result, time: Date.now() }]);
          if (isWin) {
            setBot2Action('attack'); setBot1Action('hit');
            setDmg1(formatPnl(result.pnl));
          } else {
            setBot2Action('hit'); setBot1Action('attack');
            setDmg2(formatPnl(result.pnl));
          }
          setTimeout(() => { setBot1Action('idle'); setBot2Action('idle'); setDmg1(null); setDmg2(null); }, 500);
        }
        return b;
      });

      // Random commentary
      if (Math.random() < 0.05) {
        const c = commentaries[Math.floor(Math.random() * commentaries.length)];
        setCommentary(c.replace('{b1}', bot1.name).replace('{b2}', bot2.name));
      }
    }, 1000);

    return () => clearInterval(simRef.current);
  }, [loading, matchOver, matchData, duration]);

  // Auto scroll trades
  useEffect(() => {
    if (tradeFeedRef.current) tradeFeedRef.current.scrollTop = tradeFeedRef.current.scrollHeight;
  }, [trades]);

  // Match over effects
  useEffect(() => {
    if (!matchOver) return;
    const w = bot1.pnl > bot2.pnl ? 1 : bot2.pnl > bot1.pnl ? 2 : 0;
    setBot1Action(w === 1 ? 'win' : w === 2 ? 'lose' : 'idle');
    setBot2Action(w === 2 ? 'win' : w === 1 ? 'lose' : 'idle');
    setCommentary(w === 1 ? `${bot1.name} is victorious!` : w === 2 ? `${bot2.name} takes the crown!` : "It's a draw!");
  }, [matchOver]);

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

  const bot1PnlPct = (bot1.pnl / 100000) * 100;
  const bot2PnlPct = (bot2.pnl / 100000) * 100;
  const totalP = Math.abs(bot1PnlPct) + Math.abs(bot2PnlPct) || 1;
  const bar1 = Math.max(8, Math.min(92, ((bot1PnlPct + totalP) / (2 * totalP)) * 100));
  const winner = bot1.pnl > bot2.pnl ? 1 : bot2.pnl > bot1.pnl ? 2 : 0;
  const timePct = (elapsed / duration) * 100;

  return (
    <div className={`min-h-screen px-4 py-6 ${shake ? 'animate-[shake_0.3s]' : ''}`}>
      <style jsx>{`@keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }`}</style>

      <div className="mx-auto max-w-4xl space-y-4">

        {/* ========== BATTLE ARENA ========== */}
        <Card hover={false} className="p-5 relative overflow-hidden">
          {/* Background arena glow */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            background: 'radial-gradient(ellipse at 25% 50%, var(--accent-indigo), transparent 50%), radial-gradient(ellipse at 75% 50%, var(--accent-emerald), transparent 50%)',
          }} />

          {/* Timer + progress */}
          <div className="relative flex items-center gap-3 mb-3">
            {!matchOver && <LiveDot />}
            <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple)]"
                style={{ width: `${timePct}%` }}
              />
            </div>
            <span className="text-lg font-black font-[var(--font-mono)]">
              {Math.floor((duration - elapsed) / 60)}:{String((duration - elapsed) % 60).padStart(2, '0')}
            </span>
          </div>

          {/* Health bar */}
          <div className="relative h-8 rounded-full overflow-hidden bg-[var(--bg-primary)] mb-5">
            <motion.div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--accent-indigo)] to-indigo-400" animate={{ width: `${bar1}%` }} transition={{ duration: 0.5 }} />
            <motion.div className="absolute inset-y-0 right-0 bg-gradient-to-l from-[var(--accent-emerald)] to-emerald-400" animate={{ width: `${100 - bar1}%` }} transition={{ duration: 0.5 }} />
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20" />
            <div className="absolute inset-0 flex items-center justify-between px-4">
              <span className="text-xs font-black text-white drop-shadow-lg font-[var(--font-mono)]">{bot1PnlPct >= 0 ? '+' : ''}{bot1PnlPct.toFixed(2)}%</span>
              <span className="text-xs font-black text-white drop-shadow-lg font-[var(--font-mono)]">{bot2PnlPct >= 0 ? '+' : ''}{bot2PnlPct.toFixed(2)}%</span>
            </div>
          </div>

          {/* ROBOTS */}
          <div className="relative flex items-center justify-between px-4 min-h-[180px]">
            {/* Bot 1 */}
            <div className="relative flex flex-col items-center">
              <AnimatePresence>{dmg1 && (
                <motion.div key="d1" className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 font-black font-[var(--font-mono)] text-[var(--accent-red)]"
                  style={{ textShadow: '0 0 8px rgba(239,68,68,0.5)' }}
                  initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -35 }} transition={{ duration: 0.8 }}
                >{shake ? 'CRIT! ' : ''}{dmg1}</motion.div>
              )}</AnimatePresence>
              <Robot side="left" action={bot1Action} color="#6366F1" pnlPct={bot1PnlPct} />
              <p className="mt-1 text-sm font-bold truncate max-w-[110px]">{bot1.name}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] font-[var(--font-mono)]">{bot1.trades}T / {bot1.wins}W</p>
            </div>

            {/* Center */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              {matchOver ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                  <span className="text-3xl font-black" style={{ color: '#F59E0B', textShadow: '0 0 20px rgba(245,158,11,0.5)' }}>
                    {winner ? 'KO!' : 'DRAW'}
                  </span>
                </motion.div>
              ) : combo >= 3 ? (
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.4 }}>
                  <span className="text-xl font-black text-[var(--accent-amber)]">{combo}x</span>
                </motion.div>
              ) : (
                <span className="text-2xl font-black text-white/10">VS</span>
              )}
            </div>

            {/* Bot 2 */}
            <div className="relative flex flex-col items-center">
              <AnimatePresence>{dmg2 && (
                <motion.div key="d2" className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 font-black font-[var(--font-mono)] text-[var(--accent-red)]"
                  style={{ textShadow: '0 0 8px rgba(239,68,68,0.5)' }}
                  initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -35 }} transition={{ duration: 0.8 }}
                >{shake ? 'CRIT! ' : ''}{dmg2}</motion.div>
              )}</AnimatePresence>
              <Robot side="right" action={bot2Action} color="#10B981" pnlPct={bot2PnlPct} />
              <p className="mt-1 text-sm font-bold truncate max-w-[110px]">{bot2.name}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] font-[var(--font-mono)]">{bot2.trades}T / {bot2.wins}W</p>
            </div>
          </div>

          {/* Commentary */}
          <motion.p
            key={commentary}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-xs text-[var(--text-tertiary)] italic mt-3"
          >
            {commentary}
          </motion.p>
        </Card>

        {/* ========== RESULTS ========== */}
        {matchOver && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card hover={false} className="p-6 text-center">
              <h2 className="text-3xl font-black font-[var(--font-display)] mb-4" style={{
                background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple), var(--accent-emerald))',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {winner === 1 ? `${bot1.name} WINS!` : winner === 2 ? `${bot2.name} WINS!` : 'DRAW!'}
              </h2>
              <div className="flex justify-center gap-12 mb-6">
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">{bot1.name}</p>
                  <p className="text-2xl font-black font-[var(--font-mono)] text-[var(--accent-indigo)]">{formatPnl(bot1.pnl)}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{bot1.trades} trades ({bot1.wins}W/{bot1.losses}L)</p>
                </div>
                <div className="self-center text-[var(--text-tertiary)]">vs</div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">{bot2.name}</p>
                  <p className="text-2xl font-black font-[var(--font-mono)] text-[var(--accent-emerald)]">{formatPnl(bot2.pnl)}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{bot2.trades} trades ({bot2.wins}W/{bot2.losses}L)</p>
                </div>
              </div>
              <div className="flex justify-center gap-3">
                <Button onClick={() => router.push('/matches/live')}>Play Again</Button>
                <Button variant="secondary" onClick={() => router.push('/social')}>Challenge a Friend</Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ========== TRADE FEED ========== */}
        <Card hover={false} className="h-[200px] flex flex-col">
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Trade Feed</p>
          <div ref={tradeFeedRef} className="flex-1 overflow-y-auto space-y-1">
            {trades.length === 0 && <p className="text-center text-xs text-[var(--text-tertiary)] py-8">Waiting for trades...</p>}
            {trades.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 rounded-lg bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[11px]"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.pnl > 0 ? '#10B981' : t.pnl < 0 ? '#EF4444' : '#6366F1' }} />
                <span className="font-medium">{t.bot === 1 ? bot1.name : bot2.name}</span>
                <span className="text-[var(--text-tertiary)]">{t.action} {t.symbol}</span>
                {t.pnl != null && <span className="ml-auto font-[var(--font-mono)] font-bold" style={{ color: t.pnl >= 0 ? '#10B981' : '#EF4444' }}>{formatPnl(t.pnl)}</span>}
              </motion.div>
            ))}
          </div>
        </Card>

        {/* ========== PREDICTION ========== */}
        {!matchOver && (
          <Card hover={false}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Who will win?</span>
              <div className="flex gap-2">
                <Button size="sm" variant={prediction === 1 ? 'primary' : 'secondary'} onClick={() => setPrediction(1)}>{bot1.name}</Button>
                <Button size="sm" variant={prediction === 2 ? 'primary' : 'secondary'} onClick={() => setPrediction(2)}
                  className={prediction === 2 ? 'bg-gradient-to-br from-[var(--accent-emerald)] to-emerald-600' : ''}
                >{bot2.name}</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function LiveDot() {
  return <span className="w-2 h-2 rounded-full bg-[var(--accent-red)] live-dot" />;
}
