'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatPnl, formatNumber, formatDuration } from '@/lib/utils';

// ============================================================
// BATTLE PAGE — Real Backend Match Engine
// ============================================================

interface HouseBot {
  id: string;
  name: string;
  difficulty: string;
  elo: number;
  description: string;
}

interface Bot {
  id: string;
  name: string;
  language: string;
  elo?: number;
}

interface BotStats {
  pnl: number;
  score: number;
  trades: number;
  wins: number;
  openPos: number;
  cash: number;
}

interface MatchState {
  live: boolean;
  status?: string;
  elapsed: number;
  remaining: number;
  duration: number;
  bot1: BotStats;
  bot2: BotStats;
  prices: Record<string, number>;
  bot1Pnl?: number;
  bot2Pnl?: number;
  bot1Score?: number;
  bot2Score?: number;
  winnerId?: string;
}

interface PnlPoint {
  elapsed: number;
  myPnl: number;
  oppPnl: number;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'var(--accent-emerald)',
  medium: 'var(--accent-amber)',
  hard: 'var(--accent-red)',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Rookie',
  medium: 'Veteran',
  hard: 'Elite',
};

// ---- SVG PnL Chart ----
function PnlChart({ data, height = 160 }: { data: PnlPoint[]; height?: number }) {
  if (data.length < 2) {
    return (
      <div className="w-full flex items-center justify-center text-[var(--text-tertiary)] text-sm" style={{ height }}>
        Waiting for data...
      </div>
    );
  }

  const W = 600;
  const H = height;
  const pad = 20;
  const allVals = data.flatMap(d => [d.myPnl, d.oppPnl]);
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(0.01, ...allVals);
  const range = maxV - minV || 1;
  const maxE = data[data.length - 1].elapsed || 1;

  const toX = (e: number) => pad + ((e / maxE) * (W - pad * 2));
  const toY = (v: number) => H - pad - ((v - minV) / range) * (H - pad * 2);

  const makePath = (key: 'myPnl' | 'oppPnl') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(d.elapsed).toFixed(1)},${toY(d[key]).toFixed(1)}`).join(' ');

  const zeroY = toY(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {/* Zero line */}
      <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke="var(--border-default)" strokeWidth="1" strokeDasharray="4,4" />
      {/* My bot line */}
      <path d={makePath('myPnl')} fill="none" stroke="var(--accent-indigo)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Opponent line */}
      <path d={makePath('oppPnl')} fill="none" stroke="var(--accent-emerald)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---- Main Page ----
export default function BattlePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [phase, setPhase] = useState<'select' | 'battle' | 'results'>('select');

  // Selection state
  const [myBots, setMyBots] = useState<Bot[]>([]);
  const [houseBots, setHouseBots] = useState<HouseBot[]>([]);
  const [selectedBot, setSelectedBot] = useState<string>('');
  const [selectedOpponent, setSelectedOpponent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Battle state
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [pnlHistory, setPnlHistory] = useState<PnlPoint[]>([]);
  const [lastTradeCount, setLastTradeCount] = useState({ my: 0, opp: 0 });
  const [tradeFeed, setTradeFeed] = useState<{ id: number; side: string; num: number }[]>([]);
  const tradeFeedId = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Redirect if not logged in
  useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      const token = localStorage.getItem('bta_token');
      if (!token) router.push('/auth/login');
    }
  }, [user, router]);

  // Fetch bots and house bots on mount
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      api.getBots().catch(() => []),
      api.getHouseBots().catch(() => []),
    ]).then(([bots, house]) => {
      setMyBots(bots);
      setHouseBots(house);
      if (bots.length > 0) setSelectedBot(bots[0].id);
      if (house.length > 0) {
        // Default to the opponent closest to user ELO
        const userElo = user.elo || 1000;
        const closest = house.reduce((best: HouseBot, h: HouseBot) =>
          Math.abs(h.elo - userElo) < Math.abs(best.elo - userElo) ? h : best, house[0]);
        setSelectedOpponent(closest.difficulty || closest.id);
      }
      setLoading(false);
    });
  }, [user]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startBattle = useCallback(async () => {
    if (!selectedBot || !selectedOpponent) return;
    setStarting(true);
    setError(null);
    try {
      const res = await api.startVsAI({ botId: selectedBot, difficulty: selectedOpponent });
      setMatchId(res.matchId);
      setPnlHistory([]);
      setTradeFeed([]);
      setLastTradeCount({ my: 0, opp: 0 });
      setPhase('battle');

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const state = await api.getMatchLive(res.matchId);
          setMatchState(state);

          // Accumulate PnL history
          const myPnl = state.bot1?.pnl ?? 0;
          const oppPnl = state.bot2?.pnl ?? 0;
          setPnlHistory(prev => [...prev, { elapsed: state.elapsed, myPnl, oppPnl }]);

          // Trade feed detection
          const myTrades = state.bot1?.trades ?? 0;
          const oppTrades = state.bot2?.trades ?? 0;
          setLastTradeCount(prev => {
            if (myTrades > prev.my) {
              tradeFeedId.current++;
              setTradeFeed(f => [...f.slice(-4), { id: tradeFeedId.current, side: 'You', num: myTrades }]);
            }
            if (oppTrades > prev.opp) {
              tradeFeedId.current++;
              setTradeFeed(f => [...f.slice(-4), { id: tradeFeedId.current, side: 'AI', num: oppTrades }]);
            }
            return { my: myTrades, opp: oppTrades };
          });

          // Match complete
          if (!state.live || state.status === 'COMPLETED') {
            if (pollRef.current) clearInterval(pollRef.current);
            setPhase('results');
          }
        } catch {
          // Polling error — keep trying
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to start match');
    } finally {
      setStarting(false);
    }
  }, [selectedBot, selectedOpponent]);

  const playAgain = () => {
    setPhase('select');
    setMatchId(null);
    setMatchState(null);
    setPnlHistory([]);
    setTradeFeed([]);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--accent-indigo)] border-t-transparent rounded-full" />
      </div>
    );
  }

  // ==================== PHASE 1: BOT SELECTION ====================
  if (phase === 'select') {
    return (
      <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-center mb-2"
        >
          Battle Arena
        </motion.h1>
        <p className="text-center text-[var(--text-secondary)] mb-8">
          Pit your bot against AI opponents with live market data
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30 text-[var(--accent-red)] text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-[var(--accent-indigo)] border-t-transparent rounded-full" />
          </div>
        ) : myBots.length === 0 ? (
          /* No bots CTA */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 px-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]"
          >
            <div className="text-5xl mb-4">🤖</div>
            <h2 className="text-xl font-semibold mb-2">No Bots Yet</h2>
            <p className="text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
              You need at least one trading bot to enter the arena. Create one from a template in seconds.
            </p>
            <Link href="/bots/templates">
              <Button size="lg">Create Your First Bot</Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Your Bot Selection */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
                SELECT YOUR BOT
              </label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myBots.map(bot => (
                  <button
                    key={bot.id}
                    onClick={() => setSelectedBot(bot.id)}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedBot === bot.id
                        ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--border-hover)]'
                    }`}
                  >
                    <div className="font-semibold mb-1">{bot.name}</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {bot.language} {bot.elo ? `· ${bot.elo} ELO` : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Opponent Selection */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
                CHOOSE OPPONENT
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {houseBots.map(hb => {
                  const isSelected = selectedOpponent === (hb.difficulty || hb.id);
                  const color = DIFFICULTY_COLORS[hb.difficulty] || 'var(--accent-indigo)';
                  const userElo = user.elo || 1000;
                  const isRecommended = houseBots.length > 0 &&
                    houseBots.reduce((best, h) =>
                      Math.abs(h.elo - userElo) < Math.abs(best.elo - userElo) ? h : best, houseBots[0]).id === hb.id;

                  return (
                    <button
                      key={hb.id}
                      onClick={() => setSelectedOpponent(hb.difficulty || hb.id)}
                      className={`relative p-5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[var(--accent-indigo)] bg-[var(--bg-tertiary)] shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--border-hover)]'
                      }`}
                    >
                      {isRecommended && (
                        <span className="absolute -top-2 right-3 px-2 py-0.5 text-[10px] font-bold rounded-full bg-[var(--accent-indigo)] text-white uppercase tracking-wide">
                          Recommended
                        </span>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-lg">{hb.name}</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                          style={{ background: color + '22', color }}
                        >
                          {DIFFICULTY_LABELS[hb.difficulty] || hb.difficulty}
                        </span>
                      </div>
                      <div className="font-mono text-sm text-[var(--text-secondary)] mb-1">{hb.elo} ELO</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{hb.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Start Button */}
            <div className="flex justify-center pt-4">
              <Button
                size="lg"
                loading={starting}
                disabled={!selectedBot || !selectedOpponent}
                onClick={startBattle}
                className="text-lg px-12 py-4"
              >
                START BATTLE
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== PHASE 2: LIVE BATTLE ====================
  if (phase === 'battle') {
    const ms = matchState;
    const elapsed = ms?.elapsed ?? 0;
    const duration = ms?.duration ?? 120;
    const remaining = ms?.remaining ?? duration;
    const progress = duration > 0 ? (elapsed / duration) * 100 : 0;
    const myStats = ms?.bot1;
    const oppStats = ms?.bot2;
    const prices = ms?.prices ?? {};

    return (
      <div className="min-h-screen px-4 py-6 max-w-5xl mx-auto">
        {/* Timer Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-[var(--text-secondary)] mb-2">
            <span>Elapsed: <span className="font-mono text-[var(--text-primary)]">{formatDuration(Math.floor(elapsed))}</span></span>
            <motion.span
              key={remaining}
              initial={{ scale: 1.1 }} animate={{ scale: 1 }}
              className="font-mono text-[var(--text-primary)]"
            >
              {formatDuration(Math.ceil(remaining))} remaining
            </motion.span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-purple))' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'linear' }}
            />
          </div>
        </div>

        {/* Bot Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Your Bot */}
          <motion.div
            initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            className="p-5 rounded-xl border border-[var(--accent-indigo)]/30 bg-[var(--bg-card)]"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-[var(--accent-indigo)] font-semibold uppercase tracking-wide mb-1">Your Bot</div>
                <div className="font-bold">{myBots.find(b => b.id === selectedBot)?.name || 'Your Bot'}</div>
              </div>
              <div className="text-2xl">🤖</div>
            </div>
            <div className={`text-3xl font-mono font-bold mb-3 ${(myStats?.pnl ?? 0) >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
              {formatPnl(myStats?.pnl ?? 0)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-[var(--text-secondary)]">Trades: <span className="font-mono text-[var(--text-primary)]">{myStats?.trades ?? 0}</span></div>
              <div className="text-[var(--text-secondary)]">Wins: <span className="font-mono text-[var(--text-primary)]">{myStats?.wins ?? 0}</span></div>
              <div className="text-[var(--text-secondary)]">Open: <span className="font-mono text-[var(--text-primary)]">{myStats?.openPos ?? 0}</span></div>
              <div className="text-[var(--text-secondary)]">Cash: <span className="font-mono text-[var(--text-primary)]">${formatNumber(myStats?.cash ?? 10000, 0)}</span></div>
            </div>
            {myStats?.score !== undefined && (
              <div className="mt-2 pt-2 border-t border-[var(--border-default)] text-sm text-[var(--text-secondary)]">
                Score: <span className="font-mono text-[var(--accent-indigo)] font-semibold">{formatNumber(myStats.score, 1)}</span>
              </div>
            )}
          </motion.div>

          {/* AI Opponent */}
          <motion.div
            initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            className="p-5 rounded-xl border border-[var(--accent-emerald)]/30 bg-[var(--bg-card)]"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-[var(--accent-emerald)] font-semibold uppercase tracking-wide mb-1">AI Opponent</div>
                <div className="font-bold">
                  {houseBots.find(h => (h.difficulty || h.id) === selectedOpponent)?.name || 'AI'}
                </div>
              </div>
              <div className="text-2xl">👾</div>
            </div>
            <div className={`text-3xl font-mono font-bold mb-3 ${(oppStats?.pnl ?? 0) >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
              {formatPnl(oppStats?.pnl ?? 0)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-[var(--text-secondary)]">Trades: <span className="font-mono text-[var(--text-primary)]">{oppStats?.trades ?? 0}</span></div>
              <div className="text-[var(--text-secondary)]">Wins: <span className="font-mono text-[var(--text-primary)]">{oppStats?.wins ?? 0}</span></div>
              <div className="text-[var(--text-secondary)]">Open: <span className="font-mono text-[var(--text-primary)]">{oppStats?.openPos ?? 0}</span></div>
              <div className="text-[var(--text-secondary)]">Cash: <span className="font-mono text-[var(--text-primary)]">${formatNumber(oppStats?.cash ?? 10000, 0)}</span></div>
            </div>
            {oppStats?.score !== undefined && (
              <div className="mt-2 pt-2 border-t border-[var(--border-default)] text-sm text-[var(--text-secondary)]">
                Score: <span className="font-mono text-[var(--accent-emerald)] font-semibold">{formatNumber(oppStats.score, 1)}</span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Live Market Prices */}
        {Object.keys(prices).length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            {Object.entries(prices).map(([symbol, price]) => (
              <motion.div
                key={symbol}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)]"
              >
                <span className="text-xs text-[var(--text-secondary)] uppercase">{symbol.replace('USDT', '')}</span>
                <motion.span
                  key={price}
                  initial={{ color: 'var(--accent-amber)' }}
                  animate={{ color: 'var(--text-primary)' }}
                  transition={{ duration: 0.5 }}
                  className="font-mono font-semibold text-sm"
                >
                  ${formatNumber(price as number, 2)}
                </motion.span>
              </motion.div>
            ))}
          </div>
        )}

        {/* PnL Chart */}
        <div className="mb-6 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)]">
          <div className="flex items-center gap-4 mb-2 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-[var(--accent-indigo)] rounded" />
              <span className="text-[var(--text-secondary)]">Your Bot</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-[var(--accent-emerald)] rounded" />
              <span className="text-[var(--text-secondary)]">AI Opponent</span>
            </div>
          </div>
          <PnlChart data={pnlHistory} />
        </div>

        {/* Trade Feed */}
        <AnimatePresence>
          {tradeFeed.length > 0 && (
            <div className="space-y-1 mb-4">
              {tradeFeed.slice(-3).map(t => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                >
                  {t.side === 'You' ? '🔵' : '🟢'} {t.side} executed Trade #{t.num}
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ==================== PHASE 3: RESULTS ====================
  if (phase === 'results' && matchState) {
    const ms = matchState;
    const myPnl = ms.bot1Pnl ?? ms.bot1?.pnl ?? 0;
    const oppPnl = ms.bot2Pnl ?? ms.bot2?.pnl ?? 0;
    const myScore = ms.bot1Score ?? ms.bot1?.score ?? 0;
    const oppScore = ms.bot2Score ?? ms.bot2?.score ?? 0;
    const myTrades = ms.bot1?.trades ?? 0;
    const oppTrades = ms.bot2?.trades ?? 0;
    const isWin = myPnl > oppPnl;
    const isDraw = myPnl === oppPnl;

    const myBotName = myBots.find(b => b.id === selectedBot)?.name || 'Your Bot';
    const oppName = houseBots.find(h => (h.difficulty || h.id) === selectedOpponent)?.name || 'AI';

    return (
      <div className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
        {/* Winner Announcement */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="text-center mb-8"
        >
          <div className="text-5xl mb-4">
            {isDraw ? '🤝' : isWin ? '🏆' : '💀'}
          </div>
          <h1 className={`text-3xl font-bold mb-2 ${isDraw ? 'text-[var(--accent-amber)]' : isWin ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
            {isDraw ? 'Draw!' : isWin ? 'Victory!' : 'Defeat'}
          </h1>
          <p className="text-[var(--text-secondary)]">
            {isDraw
              ? `${myBotName} and ${oppName} tied.`
              : isWin
                ? `${myBotName} defeated ${oppName}!`
                : `${oppName} defeated ${myBotName}.`}
          </p>
        </motion.div>

        {/* Score Comparison */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <motion.div
            initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            className={`p-5 rounded-xl border bg-[var(--bg-card)] ${isWin ? 'border-[var(--accent-emerald)]/40' : 'border-[var(--border-default)]'}`}
          >
            <div className="text-xs text-[var(--text-secondary)] mb-1 uppercase">Your Bot</div>
            <div className="font-bold mb-3">{myBotName}</div>
            <div className={`text-2xl font-mono font-bold mb-2 ${myPnl >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
              {formatPnl(myPnl)}
            </div>
            <div className="text-sm text-[var(--text-secondary)] space-y-1">
              <div>Score: <span className="font-mono text-[var(--text-primary)]">{formatNumber(myScore, 1)}</span></div>
              <div>Trades: <span className="font-mono text-[var(--text-primary)]">{myTrades}</span></div>
            </div>
          </motion.div>

          <motion.div
            initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            className={`p-5 rounded-xl border bg-[var(--bg-card)] ${!isWin && !isDraw ? 'border-[var(--accent-emerald)]/40' : 'border-[var(--border-default)]'}`}
          >
            <div className="text-xs text-[var(--text-secondary)] mb-1 uppercase">AI Opponent</div>
            <div className="font-bold mb-3">{oppName}</div>
            <div className={`text-2xl font-mono font-bold mb-2 ${oppPnl >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
              {formatPnl(oppPnl)}
            </div>
            <div className="text-sm text-[var(--text-secondary)] space-y-1">
              <div>Score: <span className="font-mono text-[var(--text-primary)]">{formatNumber(oppScore, 1)}</span></div>
              <div>Trades: <span className="font-mono text-[var(--text-primary)]">{oppTrades}</span></div>
            </div>
          </motion.div>
        </div>

        {/* Final PnL Chart */}
        {pnlHistory.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="mb-8 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)]"
          >
            <div className="text-sm font-semibold mb-2">Match Replay</div>
            <div className="flex items-center gap-4 mb-2 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-[var(--accent-indigo)] rounded" />
                <span className="text-[var(--text-secondary)]">{myBotName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-[var(--accent-emerald)] rounded" />
                <span className="text-[var(--text-secondary)]">{oppName}</span>
              </div>
            </div>
            <PnlChart data={pnlHistory} height={180} />
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="flex justify-center gap-4"
        >
          <Button size="lg" onClick={playAgain}>Play Again</Button>
          <Link href="/">
            <Button size="lg" variant="secondary">Back to Home</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return null;
}
