'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatPnl } from '@/lib/utils';

// ============================================================
// QUICK BATTLE — The Core Loop
// 60 seconds. 3 sliders. Instant action.
// ============================================================

const STRATEGIES = [
  { id: 'aggressive', label: 'Aggressive', icon: '⚡', desc: 'High risk, high reward' },
  { id: 'balanced', label: 'Balanced', icon: '⚖️', desc: 'Steady and smart' },
  { id: 'defensive', label: 'Defensive', icon: '🛡️', desc: 'Protect your gains' },
];

export default function Home() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [phase, setPhase] = useState<'ready' | 'fighting' | 'results'>('ready');
  const [strategy, setStrategy] = useState('balanced');
  const [aggression, setAggression] = useState(50);
  const [riskTolerance, setRiskTolerance] = useState(50);

  // Battle state
  const [elapsed, setElapsed] = useState(0);
  const [myPnl, setMyPnl] = useState(0);
  const [oppPnl, setOppPnl] = useState(0);
  const [myTrades, setMyTrades] = useState(0);
  const [oppTrades, setOppTrades] = useState(0);
  const [myWins, setMyWins] = useState(0);
  const [oppWins, setOppWins] = useState(0);
  const [b1Act, setB1Act] = useState('idle');
  const [b2Act, setB2Act] = useState('idle');
  const [dmg, setDmg] = useState<{ side: 'left' | 'right'; text: string } | null>(null);
  const [shake, setShake] = useState(false);
  const [combo, setCombo] = useState(0);
  const [commentary, setCommentary] = useState('');
  const [streak, setStreak] = useState(0);
  const [matchesPlayed, setMatchesPlayed] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const DURATION = 60;

  // Load streak from localStorage
  useEffect(() => {
    const s = parseInt(localStorage.getItem('bta_streak') || '0');
    const m = parseInt(localStorage.getItem('bta_matches') || '0');
    setStreak(s);
    setMatchesPlayed(m);
  }, []);

  const startBattle = () => {
    setPhase('fighting');
    setElapsed(0);
    setMyPnl(0); setOppPnl(0);
    setMyTrades(0); setOppTrades(0);
    setMyWins(0); setOppWins(0);
    setCombo(0);
    setCommentary('Battle begins!');

    const aggrFactor = aggression / 100;
    const riskFactor = riskTolerance / 100;
    const isAggressive = strategy === 'aggressive';
    const isDefensive = strategy === 'defensive';

    let myP = 0, oppP = 0, myT = 0, oppT = 0, myW = 0, oppW = 0, cmb = 0;
    let tick = 0;

    const comments = [
      'Your bot reads the market...', 'Opponent makes a move!',
      'Prices are volatile!', 'Perfect entry!', 'Bad timing...',
      'The crowd gasps!', 'What a trade!', 'Both bots are going all in!',
      'Momentum is shifting!', 'Critical moment!', 'Final push!',
    ];

    timerRef.current = setInterval(() => {
      tick++;
      if (tick > DURATION) {
        clearInterval(timerRef.current);
        setPhase('results');
        // Save streak
        const newMatches = matchesPlayed + 1;
        const won = myP > oppP;
        const newStreak = won ? streak + 1 : 0;
        setStreak(newStreak);
        setMatchesPlayed(newMatches);
        localStorage.setItem('bta_streak', String(newStreak));
        localStorage.setItem('bta_matches', String(newMatches));
        return;
      }

      setElapsed(tick);

      // My bot trades
      const myTradeChance = 0.12 + aggrFactor * 0.15;
      if (Math.random() < myTradeChance) {
        const skill = isAggressive ? 0.55 : isDefensive ? 0.48 : 0.52;
        const magnitude = (10 + aggrFactor * 40) * (0.5 + Math.random());
        const won = Math.random() < skill + (riskFactor * 0.05);
        const pnl = won ? magnitude : -magnitude * (1 - riskFactor * 0.3);

        myP += pnl;
        myT++;
        if (won) { myW++; cmb++; } else { cmb = 0; }
        setMyPnl(myP); setMyTrades(myT); setMyWins(myW); setCombo(cmb);

        if (won) {
          setB1Act('attack'); setB2Act('hit');
          setDmg({ side: 'right', text: `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(0)}` });
          if (pnl > 30) setShake(true);
        } else {
          setB1Act('hit'); setB2Act('attack');
          setDmg({ side: 'left', text: `-$${Math.abs(pnl).toFixed(0)}` });
        }
        setTimeout(() => { setB1Act('idle'); setB2Act('idle'); setDmg(null); setShake(false); }, 400);
      }

      // Opponent trades
      if (Math.random() < 0.14) {
        const oppWon = Math.random() < 0.50;
        const mag = 15 + Math.random() * 25;
        oppP += oppWon ? mag : -mag;
        oppT++;
        if (oppWon) oppW++;
        setOppPnl(oppP); setOppTrades(oppT); setOppWins(oppW);

        if (oppWon && Math.random() < 0.3) {
          setB2Act('attack'); setB1Act('hit');
          setTimeout(() => { setB1Act('idle'); setB2Act('idle'); }, 400);
        }
      }

      // Commentary
      if (tick % 8 === 0) {
        setCommentary(comments[Math.floor(Math.random() * comments.length)]);
      }
    }, 1000);
  };

  const myPnlPct = (myPnl / 100000) * 100;
  const oppPnlPct = (oppPnl / 100000) * 100;
  const totalP = Math.abs(myPnlPct) + Math.abs(oppPnlPct) || 1;
  const bar = Math.max(10, Math.min(90, ((myPnlPct + totalP) / (2 * totalP)) * 100));
  const iWon = myPnl > oppPnl;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 min-h-screen flex flex-col">

      {/* ===== READY PHASE ===== */}
      {phase === 'ready' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black font-[var(--font-display)]">
              <span style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Bot Trade Arena
              </span>
            </h1>
            {streak > 0 && (
              <p className="text-sm mt-1">
                <span className="text-orange-400">🔥</span>
                <span className="font-[var(--font-mono)] font-bold"> {streak} win streak</span>
              </p>
            )}
          </div>

          {/* Strategy picker */}
          <div className="mb-5">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2 font-semibold">Strategy</p>
            <div className="grid grid-cols-3 gap-2">
              {STRATEGIES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStrategy(s.id)}
                  className={`p-3 rounded-xl text-center transition-all cursor-pointer border ${
                    strategy === s.id
                      ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10'
                      : 'border-[var(--border-default)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="text-xs font-bold">{s.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4 mb-6">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--text-tertiary)]">Aggression</span>
                <span className="font-[var(--font-mono)] text-[var(--text-secondary)]">{aggression}%</span>
              </div>
              <input type="range" min="10" max="90" value={aggression} onChange={e => setAggression(+e.target.value)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, var(--accent-indigo) ${aggression}%, var(--bg-tertiary) ${aggression}%)` }}
              />
              <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
                <span>Patient</span><span>All-in</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--text-tertiary)]">Risk Tolerance</span>
                <span className="font-[var(--font-mono)] text-[var(--text-secondary)]">{riskTolerance}%</span>
              </div>
              <input type="range" min="10" max="90" value={riskTolerance} onChange={e => setRiskTolerance(+e.target.value)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, var(--accent-emerald) ${riskTolerance}%, var(--bg-tertiary) ${riskTolerance}%)` }}
              />
              <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
                <span>Safe</span><span>Yolo</span>
              </div>
            </div>
          </div>

          {/* BIG BATTLE BUTTON */}
          <motion.button
            onClick={startBattle}
            className="w-full py-5 rounded-2xl text-white text-xl font-black cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              boxShadow: '0 0 40px rgba(99, 102, 241, 0.4)',
            }}
            whileHover={{ scale: 1.02, boxShadow: '0 0 60px rgba(99, 102, 241, 0.6)' }}
            whileTap={{ scale: 0.98 }}
          >
            ⚔️ BATTLE
          </motion.button>

          {/* Bottom links */}
          <div className="mt-6 flex justify-center gap-6 text-sm">
            <Link href="/leaderboards" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Leaderboard</Link>
            {user ? (
              <>
                <Link href="/social" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Friends</Link>
                <Link href="/bots" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">My Bots</Link>
              </>
            ) : (
              <Link href="/auth/login" className="text-[var(--accent-indigo)]">Sign In</Link>
            )}
          </div>

          {/* Ranked upsell */}
          {user && (
            <div className="mt-6 p-4 rounded-xl border border-[var(--accent-purple)]/20 bg-[var(--accent-purple)]/5 text-center">
              <p className="text-sm font-bold text-[var(--accent-purple)]">⬆️ Go Ranked</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Connect your own bot. Real market data. Real ELO.</p>
              <Link href="/bots/connect">
                <Button size="sm" variant="secondary" className="mt-2">Connect Your Bot</Button>
              </Link>
            </div>
          )}
        </motion.div>
      )}

      {/* ===== FIGHTING PHASE ===== */}
      {phase === 'fighting' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex-1 flex flex-col ${shake ? 'animate-[shk_0.25s]' : ''}`}>
          <style jsx>{`@keyframes shk { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }`}</style>

          {/* Timer */}
          <div className="flex items-center gap-3 mb-3">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-red)] live-dot" />
            <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple)]"
                style={{ width: `${(elapsed / DURATION) * 100}%` }} />
            </div>
            <span className="text-xl font-black font-[var(--font-mono)]">{DURATION - elapsed}s</span>
          </div>

          {/* Health bar */}
          <div className="relative h-8 rounded-full overflow-hidden bg-[var(--bg-primary)] mb-4">
            <motion.div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#6366F1] to-indigo-400" animate={{ width: `${bar}%` }} transition={{ duration: 0.3 }} />
            <motion.div className="absolute inset-y-0 right-0 bg-gradient-to-l from-[#10B981] to-emerald-400" animate={{ width: `${100 - bar}%` }} transition={{ duration: 0.3 }} />
            <div className="absolute inset-0 flex items-center justify-between px-3 text-[11px] font-black text-white drop-shadow font-[var(--font-mono)]">
              <span>{myPnlPct >= 0 ? '+' : ''}{myPnlPct.toFixed(2)}%</span>
              <span>{oppPnlPct >= 0 ? '+' : ''}{oppPnlPct.toFixed(2)}%</span>
            </div>
          </div>

          {/* Robots */}
          <div className="relative flex items-center justify-between px-2 flex-1 min-h-[200px]">
            {/* My bot */}
            <div className="flex flex-col items-center">
              <AnimatePresence>{dmg?.side === 'left' && (
                <motion.div key="dl" className="absolute -top-2 left-[15%] z-20 font-black font-[var(--font-mono)] text-sm text-[#EF4444]"
                  style={{ textShadow: '0 0 8px #EF4444' }}
                  initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -30 }} transition={{ duration: 0.7 }}
                >{dmg.text}</motion.div>
              )}</AnimatePresence>
              <RobotSVG action={b1Act} color="#6366F1" side="left" />
              <p className="text-sm font-bold mt-1">You</p>
              <p className="text-xs font-[var(--font-mono)]" style={{ color: myPnl >= 0 ? '#10B981' : '#EF4444' }}>{formatPnl(myPnl)}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">{myTrades}T / {myWins}W</p>
            </div>

            {/* Center */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              {combo >= 3 ? (
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.4 }}>
                  <span className="text-xl font-black text-[#F59E0B]" style={{ textShadow: '0 0 15px rgba(245,158,11,0.5)' }}>{combo}x</span>
                </motion.div>
              ) : (
                <span className="text-2xl font-black text-white/[0.06]">VS</span>
              )}
            </div>

            {/* Opponent */}
            <div className="flex flex-col items-center">
              <AnimatePresence>{dmg?.side === 'right' && (
                <motion.div key="dr" className="absolute -top-2 right-[15%] z-20 font-black font-[var(--font-mono)] text-sm text-[#EF4444]"
                  style={{ textShadow: '0 0 8px #EF4444' }}
                  initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -30 }} transition={{ duration: 0.7 }}
                >{dmg.text}</motion.div>
              )}</AnimatePresence>
              <RobotSVG action={b2Act} color="#10B981" side="right" />
              <p className="text-sm font-bold mt-1">Opponent</p>
              <p className="text-xs font-[var(--font-mono)]" style={{ color: oppPnl >= 0 ? '#10B981' : '#EF4444' }}>{formatPnl(oppPnl)}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">{oppTrades}T / {oppWins}W</p>
            </div>
          </div>

          {/* Commentary */}
          <AnimatePresence mode="wait">
            <motion.p key={commentary} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center text-xs text-[var(--text-tertiary)] italic mt-2">{commentary}</motion.p>
          </AnimatePresence>
        </motion.div>
      )}

      {/* ===== RESULTS PHASE ===== */}
      {phase === 'results' && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center">
          {/* Win/Lose */}
          <motion.h1
            className="text-5xl font-black font-[var(--font-display)] mb-2"
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.5 }}
            style={{
              background: iWon ? 'linear-gradient(135deg, #22C55E, #10B981)' : 'linear-gradient(135deg, #EF4444, #DC2626)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}
          >
            {iWon ? 'VICTORY!' : myPnl === oppPnl ? 'DRAW' : 'DEFEAT'}
          </motion.h1>

          {iWon && streak > 1 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="text-sm mb-4">
              <span className="text-orange-400">🔥</span>
              <span className="font-bold font-[var(--font-mono)]"> {streak} win streak!</span>
            </motion.p>
          )}

          {/* Score comparison */}
          <div className="flex gap-8 mb-6">
            <div className="text-center">
              <p className="text-xs text-[var(--text-tertiary)]">You</p>
              <p className="text-3xl font-black font-[var(--font-mono)]" style={{ color: myPnl >= 0 ? '#10B981' : '#EF4444' }}>
                {myPnlPct >= 0 ? '+' : ''}{myPnlPct.toFixed(2)}%
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">{myTrades} trades</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[var(--text-tertiary)]">Opponent</p>
              <p className="text-3xl font-black font-[var(--font-mono)]" style={{ color: oppPnl >= 0 ? '#10B981' : '#EF4444' }}>
                {oppPnlPct >= 0 ? '+' : ''}{oppPnlPct.toFixed(2)}%
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">{oppTrades} trades</p>
            </div>
          </div>

          {/* Actions */}
          <div className="w-full space-y-3">
            <motion.button
              onClick={() => { setPhase('ready'); }}
              className="w-full py-4 rounded-2xl text-white text-lg font-black cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 0 30px rgba(99,102,241,0.3)' }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            >
              ⚔️ BATTLE AGAIN
            </motion.button>

            {!user && matchesPlayed >= 3 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="p-4 rounded-xl bg-[var(--accent-indigo)]/10 border border-[var(--accent-indigo)]/20 text-center">
                <p className="text-sm font-bold">Save your streak! Create an account.</p>
                <Link href="/auth/register"><Button className="mt-2" size="sm">Sign Up Free</Button></Link>
              </motion.div>
            )}

            {user && matchesPlayed >= 5 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="p-4 rounded-xl bg-[var(--accent-purple)]/10 border border-[var(--accent-purple)]/20 text-center">
                <p className="text-sm font-bold text-[var(--accent-purple)]">Ready for the real thing?</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Connect your own bot and compete in Ranked.</p>
                <Link href="/bots/connect"><Button className="mt-2" size="sm" variant="secondary">Go Ranked</Button></Link>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ============================================================
// ROBOT SVG — Compact fighter for mobile
// ============================================================
function RobotSVG({ action, color, side }: { action: string; color: string; side: 'left' | 'right' }) {
  const m = side === 'left' ? 1 : -1;
  const isHit = action === 'hit';
  const isAtk = action === 'attack';
  const isWin = action === 'win';

  return (
    <motion.svg width="80" height="100" viewBox="0 0 80 100"
      style={{ filter: isAtk ? `drop-shadow(0 0 12px ${color})` : 'none' }}
      animate={
        action === 'idle' ? { y: [0, -8, 0] } :
        isAtk ? { x: [0, 35 * m, 0], rotate: [0, 10 * m, 0] } :
        isHit ? { x: [0, -20 * m, 0], rotate: [0, -6 * m, 0] } :
        isWin ? { y: [0, -15, 0], scale: [1, 1.1, 1] } : {}
      }
      transition={action === 'idle' ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : isWin ? { duration: 0.6, repeat: Infinity } : { duration: 0.3 }}
    >
      {/* Head */}
      <rect x="18" y="10" width="44" height="32" rx="10" fill="#0f0f1a" stroke={isHit ? '#EF4444' : color} strokeWidth="2" />
      <motion.circle cx="32" cy="24" r="4" fill={isHit ? '#EF4444' : isAtk ? 'white' : color}
        animate={isAtk ? { r: [4, 6, 4] } : isHit ? { r: [4, 2, 4] } : {}} />
      <motion.circle cx="48" cy="24" r="4" fill={isHit ? '#EF4444' : isAtk ? 'white' : color}
        animate={isAtk ? { r: [4, 6, 4] } : isHit ? { r: [4, 2, 4] } : {}} />
      {isWin && <path d="M 32 34 Q 40 40 48 34" stroke="#22C55E" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {isHit && <path d="M 32 36 Q 40 32 48 36" stroke="#EF4444" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {/* Antenna */}
      <line x1="40" y1="3" x2="40" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="2" r="3" fill={color} />
      {/* Body */}
      <rect x="24" y="44" width="32" height="28" rx="6" fill="#0f0f1a" stroke={isHit ? '#EF4444' : color} strokeWidth="1.5" />
      <motion.circle cx="40" cy="58" r="4" fill={color} opacity="0.3"
        animate={isAtk ? { opacity: [0.3, 1, 0.3], r: [4, 7, 4] } : {}} />
      {/* Arms */}
      <motion.g style={{ transformOrigin: '24px 50px' }}
        animate={isAtk && side === 'left' ? { rotate: [0, -50, 0] } : isHit ? { rotate: [0, 15, 0] } : action === 'idle' ? { rotate: [0, -3, 0, 3, 0] } : {}}
        transition={{ duration: isAtk ? 0.25 : 1.5, repeat: action === 'idle' ? Infinity : 0 }}>
        <rect x="4" y="46" width="20" height="8" rx="4" fill={color} opacity="0.7" />
        <circle cx="5" cy="50" r="5" fill={isAtk && side === 'left' ? 'white' : color} />
      </motion.g>
      <motion.g style={{ transformOrigin: '56px 50px' }}
        animate={isAtk && side === 'right' ? { rotate: [0, 50, 0] } : isHit ? { rotate: [0, -15, 0] } : action === 'idle' ? { rotate: [0, 3, 0, -3, 0] } : {}}
        transition={{ duration: isAtk ? 0.25 : 1.5, repeat: action === 'idle' ? Infinity : 0 }}>
        <rect x="56" y="46" width="20" height="8" rx="4" fill={color} opacity="0.7" />
        <circle cx="75" cy="50" r="5" fill={isAtk && side === 'right' ? 'white' : color} />
      </motion.g>
      {/* Legs */}
      <motion.rect x="28" y="73" width="9" height="16" rx="4" fill={color} opacity="0.45"
        animate={action === 'idle' ? { height: [16, 13, 16] } : {}} transition={{ duration: 1.5, repeat: Infinity }} />
      <motion.rect x="43" y="73" width="9" height="16" rx="4" fill={color} opacity="0.45"
        animate={action === 'idle' ? { height: [13, 16, 13] } : {}} transition={{ duration: 1.5, repeat: Infinity }} />
      <rect x="25" y="88" width="14" height="5" rx="2.5" fill={color} opacity="0.3" />
      <rect x="40" y="88" width="14" height="5" rx="2.5" fill={color} opacity="0.3" />
    </motion.svg>
  );
}
