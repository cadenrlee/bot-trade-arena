'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPnl } from '@/lib/utils';

// ============================================================
// SPARK EXPLOSION
// ============================================================
function Sparks({ color, count = 12 }: { color: string; count?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * 360 + Math.random() * 30;
        const d = 30 + Math.random() * 40;
        const s = 2 + Math.random() * 5;
        return (
          <motion.div key={i} className="absolute rounded-full" style={{
            width: s, height: s, background: color, left: '50%', top: '45%',
            boxShadow: `0 0 ${s * 3}px ${color}`,
          }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: Math.cos(a * Math.PI / 180) * d, y: Math.sin(a * Math.PI / 180) * d, opacity: 0 }}
            transition={{ duration: 0.5 + Math.random() * 0.3 }}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// THE ROBOT — Animated SVG fighter with real character
// ============================================================
function Fighter({ side, action, color, name, pnl, pnlPct, trades, wins }: {
  side: 'left' | 'right'; action: string; color: string;
  name: string; pnl: number; pnlPct: number; trades: number; wins: number;
}) {
  const m = side === 'left' ? 1 : -1;
  const isHit = action === 'hit';
  const isAtk = action === 'attack';
  const isWin = action === 'win';
  const isLose = action === 'lose';

  return (
    <div className="flex flex-col items-center relative" style={{ minWidth: 120 }}>
      {/* Sparks on hit/attack */}
      {isHit && <Sparks color="#EF4444" count={14} />}
      {isAtk && <Sparks color={color} count={10} />}

      {/* Glow */}
      {(isAtk || isWin) && (
        <motion.div className="absolute rounded-full blur-3xl z-0" style={{
          background: color, width: 120, height: 120, left: '50%', top: '40%', transform: 'translate(-50%,-50%)',
        }} initial={{ opacity: 0 }} animate={{ opacity: [0.5, 0.15] }} transition={{ duration: 0.6 }} />
      )}

      <motion.svg
        width="110" height="140" viewBox="0 0 110 140"
        className="relative z-10"
        style={{ filter: (isAtk || isWin) ? `drop-shadow(0 0 20px ${color})` : 'none' }}
        animate={
          action === 'idle' ? { y: [0, -10, 0] } :
          isAtk ? { x: [0, 60 * m, 15 * m, 0], rotate: [0, 15 * m, 5 * m, 0] } :
          isHit ? { x: [0, -30 * m, -10 * m, 0], rotate: [0, -10 * m, 0] } :
          isWin ? { y: [0, -22, 0], scale: [1, 1.12, 1] } :
          isLose ? { opacity: 0.25, scale: 0.75, y: 20 } : {}
        }
        transition={
          action === 'idle' ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } :
          isWin ? { duration: 0.65, repeat: Infinity } :
          isAtk ? { duration: 0.4, times: [0, 0.3, 0.6, 1] } :
          { duration: 0.35 }
        }
      >
        {/* === HEAD === */}
        <rect x="27" y="15" width="56" height="42" rx="14" fill="#0f0f1a" stroke={isHit ? '#EF4444' : color} strokeWidth="2.5" />
        {/* Visor */}
        <rect x="33" y="24" width="44" height="18" rx="6" fill={isHit ? 'rgba(239,68,68,0.25)' : `color-mix(in srgb, ${color} 20%, transparent)`} />
        {/* Eyes — glow when attacking */}
        <motion.circle cx="43" cy="33" r="5" fill={isHit ? '#EF4444' : isAtk ? 'white' : color}
          animate={isAtk ? { r: [5, 7, 5], opacity: [1, 0.6, 1] } : isHit ? { r: [5, 2, 5] } : {}}
          style={{ filter: isAtk ? `drop-shadow(0 0 6px ${color})` : 'none' }}
        />
        <motion.circle cx="67" cy="33" r="5" fill={isHit ? '#EF4444' : isAtk ? 'white' : color}
          animate={isAtk ? { r: [5, 7, 5], opacity: [1, 0.6, 1] } : isHit ? { r: [5, 2, 5] } : {}}
          style={{ filter: isAtk ? `drop-shadow(0 0 6px ${color})` : 'none' }}
        />
        {/* Eye glint */}
        <circle cx="41" cy="31" r="2" fill="white" opacity="0.4" />
        <circle cx="65" cy="31" r="2" fill="white" opacity="0.4" />
        {/* Antenna */}
        <line x1="55" y1="5" x2="55" y2="15" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <motion.circle cx="55" cy="3" r="4" fill={color}
          animate={isWin ? { r: [4, 6, 4] } : isAtk ? { r: [4, 7, 4], fill: ['', 'white', ''] } : {}}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />

        {/* === BODY === */}
        <rect x="32" y="59" width="46" height="38" rx="8" fill="#0f0f1a" stroke={isHit ? '#EF4444' : color} strokeWidth="2" />
        {/* Chest plate */}
        <rect x="40" y="64" width="30" height="12" rx="4" fill={`color-mix(in srgb, ${color} 15%, transparent)`} stroke={color} strokeWidth="1" opacity="0.6" />
        {/* Power core */}
        <motion.circle cx="55" cy="82" r="7" fill={color} opacity="0.2"
          animate={isAtk ? { opacity: [0.2, 1, 0.2], r: [7, 10, 7] } : isWin ? { opacity: [0.2, 0.5, 0.2], r: [7, 9, 7] } : {}}
          transition={{ duration: isAtk ? 0.3 : 0.8, repeat: isWin ? Infinity : 0 }}
        />
        <motion.circle cx="55" cy="82" r="3" fill={color} opacity="0.8"
          animate={isAtk ? { r: [3, 5, 3] } : {}}
        />

        {/* === ARMS === */}
        {/* Left arm — PUNCHES on attack */}
        <motion.g style={{ transformOrigin: '32px 65px' }}
          animate={
            isAtk && side === 'left' ? { rotate: [0, -70, -20, 0], x: [0, 15, 5, 0] } :
            isAtk && side === 'right' ? { rotate: [0, 30, 0] } :
            isHit ? { rotate: [0, 25, 10, 0] } :
            action === 'idle' ? { rotate: [0, -5, 0, 5, 0] } : {}
          }
          transition={{ duration: isAtk ? 0.35 : 2, repeat: action === 'idle' ? Infinity : 0, times: isAtk ? [0, 0.25, 0.6, 1] : undefined }}
        >
          <rect x="5" y="61" width="27" height="11" rx="5.5" fill={color} opacity="0.75" />
          <circle cx="7" cy="66.5" r="7" fill={isAtk && side === 'left' ? 'white' : color} stroke={color} strokeWidth="1.5"
            style={{ filter: isAtk && side === 'left' ? `drop-shadow(0 0 8px ${color})` : 'none' }}
          />
        </motion.g>
        {/* Right arm */}
        <motion.g style={{ transformOrigin: '78px 65px' }}
          animate={
            isAtk && side === 'right' ? { rotate: [0, 70, 20, 0], x: [0, -15, -5, 0] } :
            isAtk && side === 'left' ? { rotate: [0, -30, 0] } :
            isHit ? { rotate: [0, -25, -10, 0] } :
            action === 'idle' ? { rotate: [0, 5, 0, -5, 0] } : {}
          }
          transition={{ duration: isAtk ? 0.35 : 2, repeat: action === 'idle' ? Infinity : 0, times: isAtk ? [0, 0.25, 0.6, 1] : undefined }}
        >
          <rect x="78" y="61" width="27" height="11" rx="5.5" fill={color} opacity="0.75" />
          <circle cx="103" cy="66.5" r="7" fill={isAtk && side === 'right' ? 'white' : color} stroke={color} strokeWidth="1.5"
            style={{ filter: isAtk && side === 'right' ? `drop-shadow(0 0 8px ${color})` : 'none' }}
          />
        </motion.g>

        {/* === LEGS === */}
        <motion.rect x="38" y="98" width="13" height="24" rx="6" fill={color} opacity="0.5"
          animate={action === 'idle' ? { height: [24, 20, 24] } : isWin ? { height: [24, 16, 24] } : {}}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
        <motion.rect x="59" y="98" width="13" height="24" rx="6" fill={color} opacity="0.5"
          animate={action === 'idle' ? { height: [20, 24, 20] } : isWin ? { height: [16, 24, 16] } : {}}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
        <rect x="34" y="120" width="19" height="8" rx="4" fill={color} opacity="0.35" />
        <rect x="55" y="120" width="19" height="8" rx="4" fill={color} opacity="0.35" />
      </motion.svg>

      {/* Name + stats */}
      <p className="text-sm font-bold mt-1 truncate max-w-[120px]">{name}</p>
      <span className="text-xs font-bold font-[var(--font-mono)] px-2 py-0.5 rounded-full mt-0.5" style={{
        background: pnl >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
        color: pnl >= 0 ? '#10B981' : '#EF4444',
      }}>
        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}% ({formatPnl(pnl)})
      </span>
      <p className="text-[10px] text-[var(--text-tertiary)] font-[var(--font-mono)] mt-0.5">{trades} trades / {wins}W</p>
    </div>
  );
}

// ============================================================
// MAIN PAGE — Polls REAL match data from server
// ============================================================
export default function MatchSpectatorPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [matchInfo, setMatchInfo] = useState<any>(null);
  const [liveState, setLiveState] = useState<any>(null);
  const [matchOver, setMatchOver] = useState(false);
  const [prevTrades1, setPrevTrades1] = useState(0);
  const [prevTrades2, setPrevTrades2] = useState(0);

  // Robot actions
  const [b1Act, setB1Act] = useState('idle');
  const [b2Act, setB2Act] = useState('idle');
  const [dmg1, setDmg1] = useState<string | null>(null);
  const [dmg2, setDmg2] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [combo, setCombo] = useState(0);
  const [commentary, setCommentary] = useState('Bots are entering the arena...');

  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Fetch match info once
  useEffect(() => {
    api.getMatch(matchId).then(data => { setMatchInfo(data); setLoading(false); }).catch(() => setLoading(false));
  }, [matchId]);

  // Poll live state every 1.5s
  useEffect(() => {
    if (!matchInfo) return;

    const comments = [
      `${matchInfo.bot1?.name || 'Bot 1'} is reading the market...`,
      `${matchInfo.bot2?.name || 'Bot 2'} makes a move!`,
      'Both bots are trading aggressively!',
      'The tension is building...',
      'Critical trades happening!',
      'This is anyone\'s game!',
      `${matchInfo.bot1?.name || 'Bot 1'} is on a roll!`,
      `${matchInfo.bot2?.name || 'Bot 2'} fights back!`,
      'The crowd holds its breath!',
      'Incredible execution!',
    ];

    const poll = () => {
      api.request<any>(`/api/matches/${matchId}/live`).then(state => {
        setLiveState(state);

        if (state.status === 'COMPLETED' || !state.live) {
          setMatchOver(true);
          clearInterval(pollRef.current);
        }

        // Detect new trades → trigger robot animations
        const t1 = state.bot1?.trades ?? 0;
        const t2 = state.bot2?.trades ?? 0;

        if (t1 > prevTrades1) {
          const won = (state.bot1?.pnl ?? 0) > 0;
          setB1Act(won ? 'attack' : 'hit');
          setB2Act(won ? 'hit' : 'attack');
          if (won) {
            setDmg2(`-$${Math.abs(state.bot1?.pnl ?? 0).toFixed(0)}`);
            setCombo(c => c + 1);
          } else {
            setDmg1(`-$${Math.abs(state.bot1?.pnl ?? 0).toFixed(0)}`);
            setCombo(0);
          }
          if (Math.abs(state.bot1?.pnl ?? 0) > 50) setShake(true);
          setTimeout(() => { setB1Act('idle'); setB2Act('idle'); setDmg1(null); setDmg2(null); setShake(false); }, 600);
        }
        if (t2 > prevTrades2) {
          const won = (state.bot2?.pnl ?? 0) > 0;
          setB2Act(won ? 'attack' : 'hit');
          setB1Act(won ? 'hit' : 'attack');
          setTimeout(() => { setB1Act('idle'); setB2Act('idle'); }, 600);
        }
        setPrevTrades1(t1);
        setPrevTrades2(t2);

        // Random commentary
        if (Math.random() < 0.15) {
          setCommentary(comments[Math.floor(Math.random() * comments.length)]);
        }
      }).catch(() => {});
    };

    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => clearInterval(pollRef.current);
  }, [matchInfo, matchId]);

  // Match over animations
  useEffect(() => {
    if (!matchOver || !liveState) return;
    const p1 = liveState.bot1?.pnl ?? liveState.bot1Pnl ?? 0;
    const p2 = liveState.bot2?.pnl ?? liveState.bot2Pnl ?? 0;
    setB1Act(p1 >= p2 ? 'win' : 'lose');
    setB2Act(p2 >= p1 ? 'win' : 'lose');
    const w = p1 > p2 ? matchInfo?.bot1?.name : p2 > p1 ? matchInfo?.bot2?.name : null;
    setCommentary(w ? `${w} is VICTORIOUS!` : "It's a DRAW!");
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

  if (!matchInfo) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-[var(--text-secondary)]">Match not found.</p>
      <Button variant="secondary" onClick={() => router.back()}>Go Back</Button>
    </div>
  );

  const b1 = matchInfo.bot1 || { name: 'Bot 1' };
  const b2 = matchInfo.bot2 || { name: 'Bot 2' };
  const b1Pnl = liveState?.bot1?.pnl ?? liveState?.bot1Pnl ?? matchInfo.bot1Pnl ?? 0;
  const b2Pnl = liveState?.bot2?.pnl ?? liveState?.bot2Pnl ?? matchInfo.bot2Pnl ?? 0;
  const b1Trades = liveState?.bot1?.trades ?? liveState?.bot1Trades ?? matchInfo.bot1Trades ?? 0;
  const b2Trades = liveState?.bot2?.trades ?? liveState?.bot2Trades ?? matchInfo.bot2Trades ?? 0;
  const b1Wins = liveState?.bot1?.wins ?? 0;
  const b2Wins = liveState?.bot2?.wins ?? 0;
  const b1PnlPct = (b1Pnl / 100000) * 100;
  const b2PnlPct = (b2Pnl / 100000) * 100;
  const elapsed = liveState?.elapsed ?? 0;
  const duration = liveState?.duration ?? matchInfo.duration ?? 300;
  const remaining = liveState?.remaining ?? (duration - elapsed);
  const totalP = Math.abs(b1PnlPct) + Math.abs(b2PnlPct) || 1;
  const bar1 = Math.max(8, Math.min(92, ((b1PnlPct + totalP) / (2 * totalP)) * 100));
  const winner = liveState?.winnerId ?? matchInfo.winnerId;

  return (
    <div className={`min-h-screen px-4 py-5 ${shake ? 'animate-[shk_0.25s]' : ''}`}>
      <style jsx>{`@keyframes shk { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }`}</style>

      <div className="mx-auto max-w-4xl space-y-4">

        {/* ===== BATTLE ARENA ===== */}
        <Card hover={false} className="p-5 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]" style={{
            background: 'radial-gradient(ellipse at 20% 50%, var(--accent-indigo), transparent 50%), radial-gradient(ellipse at 80% 50%, var(--accent-emerald), transparent 50%)',
          }} />

          {/* Timer */}
          <div className="relative flex items-center gap-3 mb-3">
            {!matchOver && <span className="w-2 h-2 rounded-full bg-[var(--accent-red)] live-dot" />}
            {matchOver && <span className="text-xs font-bold text-[var(--accent-amber)]">FINISHED</span>}
            <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple)]" style={{ width: `${duration > 0 ? (elapsed / duration) * 100 : 0}%` }} />
            </div>
            <span className="text-lg font-black font-[var(--font-mono)]">
              {Math.floor(Math.max(0, remaining) / 60)}:{String(Math.max(0, remaining) % 60).padStart(2, '0')}
            </span>
          </div>

          {/* Health bar */}
          <div className="relative h-9 rounded-full overflow-hidden bg-[var(--bg-primary)] mb-6">
            <motion.div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--accent-indigo)] to-indigo-400" animate={{ width: `${bar1}%` }} transition={{ duration: 0.5 }} />
            <motion.div className="absolute inset-y-0 right-0 bg-gradient-to-l from-[var(--accent-emerald)] to-emerald-400" animate={{ width: `${100 - bar1}%` }} transition={{ duration: 0.5 }} />
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20" />
            <div className="absolute inset-0 flex items-center justify-between px-4">
              <span className="text-xs font-black text-white drop-shadow-lg font-[var(--font-mono)]">{b1PnlPct >= 0 ? '+' : ''}{b1PnlPct.toFixed(2)}%</span>
              <span className="text-[10px] font-bold text-white/60">HIGHEST % GAIN WINS</span>
              <span className="text-xs font-black text-white drop-shadow-lg font-[var(--font-mono)]">{b2PnlPct >= 0 ? '+' : ''}{b2PnlPct.toFixed(2)}%</span>
            </div>
          </div>

          {/* ROBOTS FIGHTING */}
          <div className="relative flex items-start justify-between px-2 min-h-[220px]">
            <div className="relative">
              <AnimatePresence>{dmg1 && <motion.div key="d1" className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 font-black font-[var(--font-mono)]" style={{ color: shake ? '#F59E0B' : '#EF4444', fontSize: shake ? 18 : 14, textShadow: `0 0 10px ${shake ? '#F59E0B' : '#EF4444'}` }} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -40 }} transition={{ duration: 0.9 }}>{shake ? 'CRIT! ' : ''}{dmg1}</motion.div>}</AnimatePresence>
              <Fighter side="left" action={b1Act} color="#6366F1" name={b1.name} pnl={b1Pnl} pnlPct={b1PnlPct} trades={b1Trades} wins={b1Wins} />
            </div>

            {/* Center */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-10">
              {matchOver ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.7, repeat: Infinity }}>
                  <span className="text-4xl font-black" style={{ color: '#F59E0B', textShadow: '0 0 30px rgba(245,158,11,0.6)' }}>{winner ? 'KO!' : 'DRAW'}</span>
                </motion.div>
              ) : combo >= 3 ? (
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5 }}>
                  <span className="text-2xl font-black text-[var(--accent-amber)]" style={{ textShadow: '0 0 15px rgba(245,158,11,0.4)' }}>{combo}x</span>
                </motion.div>
              ) : (
                <span className="text-3xl font-black text-white/[0.06]">VS</span>
              )}
            </div>

            <div className="relative">
              <AnimatePresence>{dmg2 && <motion.div key="d2" className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 font-black font-[var(--font-mono)]" style={{ color: shake ? '#F59E0B' : '#EF4444', fontSize: shake ? 18 : 14, textShadow: `0 0 10px ${shake ? '#F59E0B' : '#EF4444'}` }} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -40 }} transition={{ duration: 0.9 }}>{shake ? 'CRIT! ' : ''}{dmg2}</motion.div>}</AnimatePresence>
              <Fighter side="right" action={b2Act} color="#10B981" name={b2.name} pnl={b2Pnl} pnlPct={b2PnlPct} trades={b2Trades} wins={b2Wins} />
            </div>
          </div>

          {/* Commentary */}
          <AnimatePresence mode="wait">
            <motion.p key={commentary} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center text-xs text-[var(--text-tertiary)] italic mt-3">
              {commentary}
            </motion.p>
          </AnimatePresence>
        </Card>

        {/* ===== RESULTS ===== */}
        {matchOver && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card hover={false} className="p-6 text-center">
              <h2 className="text-3xl font-black font-[var(--font-display)] mb-4" style={{
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6, #10B981)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {b1Pnl > b2Pnl ? `${b1.name} WINS!` : b2Pnl > b1Pnl ? `${b2.name} WINS!` : 'DRAW!'}
              </h2>
              <div className="flex justify-center gap-12 mb-6">
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">{b1.name}</p>
                  <p className="text-2xl font-black font-[var(--font-mono)] text-[#6366F1]">{formatPnl(b1Pnl)}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{b1Trades} trades</p>
                </div>
                <div className="self-center text-[var(--text-tertiary)]">vs</div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">{b2.name}</p>
                  <p className="text-2xl font-black font-[var(--font-mono)] text-[#10B981]">{formatPnl(b2Pnl)}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{b2Trades} trades</p>
                </div>
              </div>
              <div className="flex justify-center gap-3">
                <Button onClick={() => router.push('/matches/live')}>Play Again</Button>
                <Button variant="secondary" onClick={() => router.push(`/matches/${matchId}/replay`)}>Watch Replay</Button>
                <Button variant="secondary" onClick={() => router.push('/social')}>Challenge a Friend</Button>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
