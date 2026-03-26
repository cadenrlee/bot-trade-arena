'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatPnl } from '@/lib/utils';
import {
  WEAPONS, ROBOT_SKINS, RARITY_COLORS,
  getPlayerStats, updatePlayerStats, getUnlockedWeapons,
  getEquippedWeapon, getEquippedSkin, type Weapon, type RobotSkin,
} from '@/lib/weapons';
import {
  getBattlePassState, addBattlePassXP, claimDailyBonus, getXPForCurrentLevel,
  SEASON_NAME, type BattlePassTier,
} from '@/lib/battlepass';
import { addMatchToHistory } from '@/lib/matchHistory';

// ============================================================
// QUICK BATTLE — The Core Loop
// 60 seconds. 3 sliders. Instant action.
// ============================================================

const STRATEGIES = [
  { id: 'aggressive', label: 'Aggressive', icon: '⚡', desc: 'High risk, high reward', winRate: 0.58, tradeMult: 1.4, pnlMult: 1.8 },
  { id: 'balanced', label: 'Balanced', icon: '⚖️', desc: 'Steady and smart', winRate: 0.52, tradeMult: 1.0, pnlMult: 1.0 },
  { id: 'defensive', label: 'Defensive', icon: '🛡️', desc: 'Protect your gains', winRate: 0.45, tradeMult: 0.7, pnlMult: 0.5 },
];

// Named AI opponents — makes it feel like you're fighting real players
const AI_OPPONENTS = [
  { name: 'NoviceBot', elo: 850, strategy: 'defensive', difficulty: 0.35 },
  { name: 'TradeJunkie', elo: 950, strategy: 'aggressive', difficulty: 0.42 },
  { name: 'AlgoKid', elo: 1020, strategy: 'balanced', difficulty: 0.48 },
  { name: 'MomentumMax', elo: 1100, strategy: 'aggressive', difficulty: 0.50 },
  { name: 'SteadyEddie', elo: 1200, strategy: 'defensive', difficulty: 0.52 },
  { name: 'QuantWiz', elo: 1350, strategy: 'balanced', difficulty: 0.55 },
  { name: 'SharpeStar', elo: 1500, strategy: 'aggressive', difficulty: 0.58 },
  { name: 'DeepAlpha', elo: 1650, strategy: 'balanced', difficulty: 0.62 },
  { name: 'NeuralEdge', elo: 1800, strategy: 'aggressive', difficulty: 0.66 },
  { name: 'GodMode', elo: 2000, strategy: 'balanced', difficulty: 0.72 },
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
  const [newUnlocks, setNewUnlocks] = useState<Weapon[]>([]);
  const [equippedWeapon, setEquippedWeapon] = useState<Weapon>(WEAPONS[0]);
  const [equippedSkin, setEquippedSkin] = useState<RobotSkin>(ROBOT_SKINS[0]);
  const [playerStats, setPlayerStats] = useState(getPlayerStats());
  const [opponent, setOpponent] = useState(AI_OPPONENTS[2]);
  const [myElo, setMyElo] = useState(1000);
  const [eloChange, setEloChange] = useState(0);
  const [screenFlash, setScreenFlash] = useState<string | null>(null);
  const [bpXpGained, setBpXpGained] = useState(0);
  const [bpLevelUp, setBpLevelUp] = useState<BattlePassTier | null>(null);
  const [bpState, setBpState] = useState(getBattlePassState());

  // Interactive market events — the skill element
  const [marketEvent, setMarketEvent] = useState<{ id: number; text: string; emoji: string; bonus: number; deadline: number } | null>(null);
  const [eventsCaught, setEventsCaught] = useState(0);
  const [eventsMissed, setEventsMissed] = useState(0);
  const eventIdRef = useRef(0);

  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const pendingTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const DURATION = 60;

  // Cleanup interval and pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      pendingTimeoutsRef.current.forEach(t => clearTimeout(t));
      pendingTimeoutsRef.current = [];
    };
  }, []);

  // Load stats from localStorage
  useEffect(() => {
    const stats = getPlayerStats();
    setPlayerStats(stats);
    setStreak(stats.winStreak);
    setMatchesPlayed(stats.totalMatches);
    const wId = getEquippedWeapon();
    setEquippedWeapon(WEAPONS.find(w => w.id === wId) || WEAPONS[0]);
    const sId = getEquippedSkin();
    setEquippedSkin(ROBOT_SKINS.find(s => s.id === sId) || ROBOT_SKINS[0]);
    setMyElo(parseInt(localStorage.getItem('bta_elo') || '1000'));
    setBpState(getBattlePassState());
    setBpLevelUp(null);
    setBpXpGained(0);
  }, [phase]);

  const startBattle = () => {
    // Pick opponent near your ELO
    const savedElo = parseInt(localStorage.getItem('bta_elo') || '1000');
    setMyElo(savedElo);
    const nearbyOpps = AI_OPPONENTS.filter(o => Math.abs(o.elo - savedElo) < 400);
    const opp = nearbyOpps[Math.floor(Math.random() * nearbyOpps.length)] || AI_OPPONENTS[2];
    setOpponent(opp);

    pendingTimeoutsRef.current.forEach(t => clearTimeout(t));
    pendingTimeoutsRef.current = [];

    setPhase('fighting');
    setElapsed(0);
    setMyPnl(0); setOppPnl(0);
    setMyTrades(0); setOppTrades(0);
    setMyWins(0); setOppWins(0);
    setCombo(0); setEloChange(0);
    setMarketEvent(null); setEventsCaught(0); setEventsMissed(0);
    setCommentary(`Matched against ${opp.name} (${opp.elo} ELO)...`);

    const strat = STRATEGIES.find(s => s.id === strategy) || STRATEGIES[1];
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
        // Update stats and check for new unlocks
        const beforeUnlocks = getUnlockedWeapons(getPlayerStats()).map(w => w.id);
        const newStats = updatePlayerStats(won, myT);
        const afterUnlocks = getUnlockedWeapons(newStats).map(w => w.id);
        const justUnlocked = afterUnlocks.filter(id => !beforeUnlocks.includes(id));
        if (justUnlocked.length > 0) {
          setNewUnlocks(WEAPONS.filter(w => justUnlocked.includes(w.id)));
        }
        // ELO change
        const eloDelta = won ? Math.round(15 + Math.random() * 15) : -Math.round(10 + Math.random() * 10);
        const newElo = Math.max(100, savedElo + eloDelta);
        setEloChange(eloDelta);
        setMyElo(newElo);
        localStorage.setItem('bta_elo', String(newElo));

        // Battle Pass XP
        let xpEarned = won ? 100 : 30;
        if (won && newStats.winStreak > 1) xpEarned += 50; // streak bonus
        const bpDailyState = getBattlePassState();
        if (!bpDailyState.dailyBonusClaimed) {
          xpEarned += claimDailyBonus();
        }
        const bpResult = addBattlePassXP(xpEarned);
        setBpXpGained(xpEarned);
        setBpState(getBattlePassState());
        if (bpResult.leveledUp && bpResult.reward) {
          setBpLevelUp(bpResult.reward);
        }

        // Save to match history
        addMatchToHistory({
          id: `qb_${Date.now()}`,
          timestamp: Date.now(),
          opponent: opp.name,
          opponentElo: opp.elo,
          myPnl: myP,
          oppPnl: oppP,
          myPnlPct: (myP / 100000) * 100,
          oppPnlPct: (oppP / 100000) * 100,
          myTrades: myT,
          oppTrades: oppT,
          won,
          eloChange: eloDelta,
          newElo,
          strategy,
          eventsCaught: 0, // will be updated by state
          eventsMissed: 0,
          xpEarned,
          isMultiplayer: false,
        });

        setStreak(newStats.winStreak);
        setMatchesPlayed(newStats.totalMatches);
        setPlayerStats(newStats);
        return;
      }

      setElapsed(tick);

      // My bot trades — sliders VISIBLY change behavior
      const myTradeChance = (0.08 + aggrFactor * 0.18) * strat.tradeMult;
      if (Math.random() < myTradeChance) {
        const skill = strat.winRate + (riskFactor * 0.06) - 0.03;
        const magnitude = (8 + aggrFactor * 35) * strat.pnlMult * (0.5 + Math.random());
        const won = Math.random() < skill;
        // High risk = bigger wins AND bigger losses. Low risk = smaller both.
        const pnl = won ? magnitude : -magnitude * (1.2 - riskFactor * 0.5);

        myP += pnl;
        myT++;
        if (won) { myW++; cmb++; } else { cmb = 0; }
        setMyPnl(myP); setMyTrades(myT); setMyWins(myW); setCombo(cmb);

        if (won) {
          setB1Act('attack'); setB2Act('hit');
          setDmg({ side: 'right', text: `+$${Math.abs(pnl).toFixed(0)}` });
          setScreenFlash('rgba(34,197,94,0.15)');
          if (pnl > 25) setShake(true);
        } else {
          setB1Act('hit'); setB2Act('attack');
          setDmg({ side: 'left', text: `-$${Math.abs(pnl).toFixed(0)}` });
          setScreenFlash('rgba(239,68,68,0.12)');
        }
        const t1 = setTimeout(() => { setB1Act('idle'); setB2Act('idle'); setDmg(null); setShake(false); setScreenFlash(null); }, 500);
        pendingTimeoutsRef.current.push(t1);
      }

      // Opponent trades — difficulty scales with their ELO
      if (Math.random() < 0.12) {
        const oppWon = Math.random() < opp.difficulty;
        const mag = 12 + Math.random() * 30;
        oppP += oppWon ? mag : -mag;
        oppT++;
        if (oppWon) oppW++;
        setOppPnl(oppP); setOppTrades(oppT); setOppWins(oppW);

        if (oppWon && Math.random() < 0.3) {
          setB2Act('attack'); setB1Act('hit');
          const t2 = setTimeout(() => { setB1Act('idle'); setB2Act('idle'); }, 400);
          pendingTimeoutsRef.current.push(t2);
        }
      }

      // Market events — pop up for player to tap (the skill element!)
      if (tick % 12 === 6 && !marketEvent) {
        const events = [
          { text: 'BTC Breakout!', emoji: '📈', bonus: 30 },
          { text: 'Flash Crash!', emoji: '💥', bonus: 25 },
          { text: 'Volume Spike!', emoji: '📊', bonus: 20 },
          { text: 'Whale Alert!', emoji: '🐋', bonus: 35 },
          { text: 'Bull Signal!', emoji: '🐂', bonus: 28 },
          { text: 'Momentum Shift!', emoji: '🔄', bonus: 22 },
          { text: 'Earnings Beat!', emoji: '💰', bonus: 32 },
          { text: 'Short Squeeze!', emoji: '🚀', bonus: 40 },
        ];
        const ev = events[Math.floor(Math.random() * events.length)];
        eventIdRef.current++;
        setMarketEvent({ ...ev, id: eventIdRef.current, deadline: Date.now() + 2500 });
        // Auto-expire if not tapped
        const evId = eventIdRef.current;
        setTimeout(() => {
          setMarketEvent(prev => {
            if (prev && prev.id === evId) {
              // Missed! Opponent gets the bonus
              oppP += ev.bonus * 0.7;
              setOppPnl(oppP);
              setEventsMissed(m => m + 1);
              setCommentary(`${opp.name} capitalizes on ${ev.text}`);
              return null;
            }
            return prev;
          });
        }, 2500);
      }

      // Commentary
      if (tick % 8 === 0) {
        setCommentary(comments[Math.floor(Math.random() * comments.length)]);
      }
    }, 1000);
  };

  const handleTapEvent = () => {
    if (!marketEvent) return;
    // Player caught the event! Bonus trade
    setMyPnl(prev => prev + marketEvent.bonus);
    setMyWins(w => w + 1);
    setMyTrades(t => t + 1);
    setCombo(c => c + 1);
    setEventsCaught(c => c + 1);
    setB1Act('attack'); setB2Act('hit');
    setDmg({ side: 'right', text: `+$${marketEvent.bonus}` });
    setScreenFlash('rgba(34,197,94,0.2)');
    setShake(true);
    setCommentary(`You caught the ${marketEvent.text}!`);
    setMarketEvent(null);
    setTimeout(() => { setB1Act('idle'); setB2Act('idle'); setDmg(null); setShake(false); setScreenFlash(null); }, 500);
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
          <div className="text-center mb-5">
            <h1 className="text-3xl font-black font-[var(--font-display)]">
              <span style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Bot Trade Arena
              </span>
            </h1>
            <div className="flex items-center justify-center gap-4 mt-1.5 text-sm">
              {streak > 0 && (
                <span><span className="text-orange-400">🔥</span> <span className="font-[var(--font-mono)] font-bold">{streak}</span></span>
              )}
              <span className="font-[var(--font-mono)] text-xs text-[var(--text-secondary)]">{myElo} ELO</span>
              <span className="text-[var(--text-tertiary)] text-xs">{playerStats.totalWins}W</span>
            </div>
            {/* Battle Pass progress */}
            <div className="mt-2 px-4">
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-[var(--text-tertiary)]">Tier {bpState.level}/50</span>
                <span className="text-[var(--accent-indigo)] font-[var(--font-mono)]">{getXPForCurrentLevel().current}/{getXPForCurrentLevel().needed} XP</span>
              </div>
              <div className="h-1 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple)]"
                  style={{ width: `${(getXPForCurrentLevel().current / getXPForCurrentLevel().needed) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Equipped weapon */}
          <Link href="/armory">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] mb-4 cursor-pointer hover:border-[var(--border-hover)] transition-all">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{equippedWeapon.emoji}</span>
                <div>
                  <p className="text-sm font-bold">{equippedWeapon.name}</p>
                  <p className="text-[10px]" style={{ color: RARITY_COLORS[equippedWeapon.rarity] }}>{equippedWeapon.rarity.toUpperCase()}</p>
                </div>
              </div>
              <span className="text-xs text-[var(--text-tertiary)]">Armory →</span>
            </div>
          </Link>

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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex-1 flex flex-col relative ${shake ? 'animate-[shk_0.25s]' : ''}`}>
          <style jsx>{`@keyframes shk { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }`}</style>
          {/* Screen flash on hit */}
          <AnimatePresence>
            {screenFlash && (
              <motion.div
                key="flash"
                className="absolute inset-0 z-30 pointer-events-none rounded-2xl"
                style={{ background: screenFlash }}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
            )}
          </AnimatePresence>

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
                <motion.div key="dl" className="absolute -top-2 left-[15%] z-20 font-black font-[var(--font-mono)] text-sm"
                  style={{ color: equippedWeapon.attackColor, textShadow: `0 0 8px ${equippedWeapon.attackColor}` }}
                  initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -30 }} transition={{ duration: 0.7 }}
                >{dmg.text}</motion.div>
              )}</AnimatePresence>
              <RobotSVG action={b1Act} color={equippedSkin.bodyColor} side="left" />
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
                <motion.div key="dr" className="absolute -top-2 right-[15%] z-20 font-black font-[var(--font-mono)] text-sm"
                  style={{ color: equippedWeapon.attackColor, textShadow: `0 0 8px ${equippedWeapon.attackColor}` }}
                  initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -30 }} transition={{ duration: 0.7 }}
                >{dmg.text}</motion.div>
              )}</AnimatePresence>
              <RobotSVG action={b2Act} color="#10B981" side="right" />
              <p className="text-sm font-bold mt-1">{opponent.name}</p>
              <p className="text-xs font-[var(--font-mono)]" style={{ color: oppPnl >= 0 ? '#10B981' : '#EF4444' }}>{formatPnl(oppPnl)}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">{oppTrades}T / {oppWins}W</p>
            </div>
          </div>

          {/* MARKET EVENT — tap to catch! */}
          <AnimatePresence>
            {marketEvent && (
              <motion.button
                key={marketEvent.id}
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: [1, 1.05, 1], y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: -20 }}
                transition={{ duration: 0.3 }}
                onClick={handleTapEvent}
                className="w-full py-4 rounded-2xl text-center cursor-pointer mt-3 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.1))',
                  border: '2px solid rgba(245,158,11,0.4)',
                  boxShadow: '0 0 30px rgba(245,158,11,0.2)',
                }}
              >
                {/* Shrinking deadline bar */}
                <motion.div
                  className="absolute bottom-0 left-0 h-1 bg-[#F59E0B]"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 2.5, ease: 'linear' }}
                />
                <span className="text-2xl">{marketEvent.emoji}</span>
                <p className="text-sm font-black text-[#F59E0B] mt-1">{marketEvent.text}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">TAP to trade! +${marketEvent.bonus}</p>
              </motion.button>
            )}
          </AnimatePresence>

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
            {iWon ? 'VICTORY!' : Math.abs(myPnl - oppPnl) < 1 ? 'DRAW' : 'DEFEAT'}
          </motion.h1>

          {/* ELO change */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-3 mb-2">
            <span className="text-sm text-[var(--text-tertiary)]">vs {opponent.name}</span>
            <span className="font-[var(--font-mono)] font-bold text-lg" style={{ color: eloChange >= 0 ? '#10B981' : '#EF4444' }}>
              {eloChange >= 0 ? '+' : ''}{eloChange} ELO
            </span>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="text-sm text-center mb-2 font-[var(--font-mono)]">
            Your ELO: <span className="font-bold">{myElo}</span>
            {iWon && streak > 1 && <span className="ml-3 text-orange-400">🔥 {streak} streak!</span>}
          </motion.p>
          {eventsCaught + eventsMissed > 0 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              className="text-xs text-center mb-4 text-[var(--text-tertiary)]">
              Market events: <span className="text-[var(--accent-emerald)] font-bold">{eventsCaught} caught</span>
              {eventsMissed > 0 && <span className="text-[var(--accent-red)]"> / {eventsMissed} missed</span>}
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

          {/* Battle Pass XP */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="w-full p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[var(--text-tertiary)]">{SEASON_NAME} — Tier {bpState.level}/50</span>
              <span className="text-xs font-[var(--font-mono)] text-[var(--accent-indigo)]">+{bpXpGained} XP</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple)]"
                initial={{ width: '0%' }}
                animate={{ width: `${(getXPForCurrentLevel().current / getXPForCurrentLevel().needed) * 100}%` }}
                transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            {!bpState.hasPremium && (
              <p className="text-[10px] text-[var(--accent-purple)] mt-1.5 text-center">
                🔒 Unlock Premium rewards — <span className="font-bold">Battle Pass $4.99</span>
              </p>
            )}
          </motion.div>

          {/* Battle Pass level up */}
          {bpLevelUp && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7, type: 'spring' }}
              className="w-full p-4 rounded-xl bg-gradient-to-r from-[var(--accent-indigo)]/10 to-[var(--accent-purple)]/10 border border-[var(--accent-indigo)]/30 mb-3 text-center">
              <p className="text-xs text-[var(--accent-indigo)] font-bold uppercase tracking-wider mb-1">TIER {bpLevelUp.level} UNLOCKED!</p>
              <p className="text-sm font-bold">{bpLevelUp.freeReward?.name || 'Reward'}</p>
              {bpLevelUp.premiumReward && !bpState.hasPremium && (
                <p className="text-[10px] text-[var(--accent-purple)] mt-1">Premium: {bpLevelUp.premiumReward.name} 🔒</p>
              )}
            </motion.div>
          )}

          {/* New weapon unlocks! */}
          {newUnlocks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
              className="p-5 rounded-2xl text-center mb-4"
              style={{
                background: `linear-gradient(135deg, ${RARITY_COLORS[newUnlocks[0].rarity]}15, transparent)`,
                border: `2px solid ${RARITY_COLORS[newUnlocks[0].rarity]}40`,
                boxShadow: `0 0 30px ${RARITY_COLORS[newUnlocks[0].rarity]}20`,
              }}
            >
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6, repeat: 2 }}>
                <p className="text-3xl mb-2">{newUnlocks[0].emoji}</p>
              </motion.div>
              <p className="text-xs uppercase tracking-wider font-bold mb-1" style={{ color: RARITY_COLORS[newUnlocks[0].rarity] }}>
                {newUnlocks[0].rarity} WEAPON UNLOCKED!
              </p>
              <p className="text-lg font-black">{newUnlocks[0].name}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{newUnlocks[0].description}</p>
              <Link href="/armory">
                <Button size="sm" className="mt-3">Equip Now</Button>
              </Link>
            </motion.div>
          )}

          {/* Next unlock progress */}
          {newUnlocks.length === 0 && (() => {
            const nextWeapon = WEAPONS.find(w => !w.unlockCheck(playerStats));
            if (!nextWeapon) return null;
            return (
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl opacity-40">{nextWeapon.emoji}</span>
                  <div className="flex-1">
                    <p className="text-xs text-[var(--text-tertiary)]">Next unlock: <span className="font-bold text-[var(--text-secondary)]">{nextWeapon.name}</span></p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">{nextWeapon.unlockRequirement}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: RARITY_COLORS[nextWeapon.rarity], background: `${RARITY_COLORS[nextWeapon.rarity]}15` }}>
                    {nextWeapon.rarity}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Actions */}
          <div className="w-full space-y-3">
            <motion.button
              onClick={() => { setPhase('ready'); setNewUnlocks([]); }}
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
