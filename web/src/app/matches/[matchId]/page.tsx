'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { spectatorSocket } from '@/lib/ws';
import { useMatchStore } from '@/stores/match';
import { Card } from '@/components/ui/card';
import { TierBadge } from '@/components/ui/tier-badge';
import { LiveDot } from '@/components/ui/live-dot';
import { Button } from '@/components/ui/button';
import { formatDuration, formatPnl, formatNumber } from '@/lib/utils';

export default function MatchSpectatorPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const {
    matchData,
    currentTick,
    trades,
    pnlHistory,
    spectatorCount,
    setActiveMatch,
    updateTick,
    addTrade,
    setSpectatorCount,
    clearMatch,
  } = useMatchStore();

  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<'bot1' | 'bot2' | null>(null);
  const tradeFeedRef = useRef<HTMLDivElement>(null);

  const [matchOver, setMatchOver] = useState(false);

  // Fetch match data + poll for updates (WebSocket is bonus, not required)
  useEffect(() => {
    let mounted = true;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    async function fetchMatch() {
      try {
        const data = await api.getMatch(matchId);
        if (!mounted) return;
        setActiveMatch(matchId, data);
        setLoading(false);

        // If match is completed, show results
        if (data.status === 'COMPLETED') {
          setMatchOver(true);
          // Build a fake tick from the completed match data
          updateTick({
            elapsed: data.duration || 300,
            remaining: 0,
            prices: {},
            bot1: {
              botId: data.bot1?.id || '',
              pnl: data.bot1Pnl || 0,
              totalCapital: 100000 + (data.bot1Pnl || 0),
              trades: data.bot1Trades || 0,
              wins: 0,
              losses: 0,
              winRate: data.bot1WinRate || 0,
              openPositions: 0,
            },
            bot2: {
              botId: data.bot2?.id || '',
              pnl: data.bot2Pnl || 0,
              totalCapital: 100000 + (data.bot2Pnl || 0),
              trades: data.bot2Trades || 0,
              wins: 0,
              losses: 0,
              winRate: data.bot2WinRate || 0,
              openPositions: 0,
            },
          });
          return;
        }

        // Still running — keep polling
      } catch {
        if (mounted) setLoading(false);
      }
    }

    fetchMatch();

    // Poll every 2 seconds for live match data (REST fallback for when WS isn't available)
    pollTimer = setInterval(() => {
      if (!mounted || matchOver) return;
      api.getMatch(matchId).then((data) => {
        if (!mounted) return;
        if (data.status === 'COMPLETED') {
          setMatchOver(true);
          updateTick({
            elapsed: data.duration || 300,
            remaining: 0,
            prices: {},
            bot1: {
              botId: data.bot1?.id || '',
              pnl: data.bot1Pnl || 0,
              totalCapital: 100000 + (data.bot1Pnl || 0),
              trades: data.bot1Trades || 0,
              wins: 0, losses: 0,
              winRate: data.bot1WinRate || 0,
              openPositions: 0,
            },
            bot2: {
              botId: data.bot2?.id || '',
              pnl: data.bot2Pnl || 0,
              totalCapital: 100000 + (data.bot2Pnl || 0),
              trades: data.bot2Trades || 0,
              wins: 0, losses: 0,
              winRate: data.bot2WinRate || 0,
              openPositions: 0,
            },
          });
        }
      }).catch(() => {});
    }, 2000);

    // Also try WebSocket for real-time updates (works locally, may not work on hosted)
    try {
      spectatorSocket.connect();
      spectatorSocket.subscribeMatch(matchId);
    } catch { /* WS optional */ }

    const offTick = spectatorSocket.on('match:tick', (data) => {
      if (mounted) updateTick(data);
    });

    const offTrade = spectatorSocket.on('match:trade', (data) => {
      if (mounted) addTrade(data);
    });

    const offSpectators = spectatorSocket.on('match:spectators', (data) => {
      if (mounted) setSpectatorCount(data.count);
    });

    const offEnd = spectatorSocket.on('match:end', () => {
      if (mounted) setMatchOver(true);
    });

    return () => {
      mounted = false;
      if (pollTimer) clearInterval(pollTimer);
      spectatorSocket.unsubscribeMatch(matchId);
      offTick();
      offTrade();
      offSpectators();
      offEnd();
      clearMatch();
    };
  }, [matchId]);

  // Auto-scroll trade feed
  useEffect(() => {
    if (tradeFeedRef.current) {
      tradeFeedRef.current.scrollTop = tradeFeedRef.current.scrollHeight;
    }
  }, [trades]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <svg className="animate-spin h-8 w-8 text-[var(--accent-indigo)]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-primary)] gap-4">
        <p className="text-[var(--text-secondary)]">Match not found.</p>
        <Button variant="secondary" onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  const bot1 = matchData.bot1 || { name: 'Bot 1', elo: 1000 };
  const bot2 = matchData.bot2 || { name: 'Bot 2', elo: 1000 };
  const bot1Pnl = currentTick?.bot1?.pnl ?? matchData.bot1Pnl ?? 0;
  const bot2Pnl = currentTick?.bot2?.pnl ?? matchData.bot2Pnl ?? 0;
  const totalPnl = Math.abs(bot1Pnl) + Math.abs(bot2Pnl) || 1;
  const bot1BarPct = ((bot1Pnl + totalPnl) / (2 * totalPnl)) * 100;
  const remaining = currentTick?.remaining ?? matchData.duration ?? 0;
  const isCompleted = matchOver || matchData.status === 'COMPLETED';
  const isRunning = matchData.status === 'RUNNING' && !matchOver;
  const winnerId = matchData.winnerId;
  const bot1Score = matchData.bot1Score;
  const bot2Score = matchData.bot2Score;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Tug-of-war bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <LiveDot />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {matchData.tier && <TierBadge tier={matchData.tier} size="sm" />}
            </span>
          </div>

          <div className="relative h-4 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: 'linear-gradient(to right, var(--accent-indigo), var(--accent-purple))',
              }}
              animate={{ width: `${bot1BarPct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute inset-y-0 right-0 rounded-full"
              style={{
                background: 'linear-gradient(to left, var(--accent-emerald), var(--accent-teal, var(--accent-emerald)))',
              }}
              animate={{ width: `${100 - bot1BarPct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          <div className="mt-1 flex justify-between text-xs font-[var(--font-mono)] text-[var(--text-tertiary)]">
            <span>{formatPnl(bot1Pnl)}</span>
            <span>{formatPnl(bot2Pnl)}</span>
          </div>
        </motion.div>

        {/* Match status */}
        {isCompleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <h2 className="text-3xl font-black font-[var(--font-display)]" style={{
              background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {winnerId === matchData.bot1Id ? `${bot1.name} WINS!` :
               winnerId === matchData.bot2Id ? `${bot2.name} WINS!` :
               'DRAW!'}
            </h2>
            <div className="flex justify-center gap-8 mt-4">
              <div className="text-center">
                <p className="text-xs text-[var(--text-tertiary)]">{bot1.name}</p>
                <p className="text-2xl font-bold font-[var(--font-mono)] text-[var(--accent-indigo)]">{Math.round(bot1Score || 0)}</p>
              </div>
              <div className="text-sm text-[var(--text-tertiary)] self-center">vs</div>
              <div className="text-center">
                <p className="text-xs text-[var(--text-tertiary)]">{bot2.name}</p>
                <p className="text-2xl font-bold font-[var(--font-mono)] text-[var(--accent-emerald)]">{Math.round(bot2Score || 0)}</p>
              </div>
            </div>
            <div className="flex justify-center gap-3 mt-4">
              <Button size="sm" onClick={() => window.location.href = '/matches/live'}>Play Again</Button>
              <Button size="sm" variant="secondary" onClick={() => window.location.href = `/matches/${matchId}/results`}>Full Results</Button>
            </div>
          </motion.div>
        )}

        {isRunning && !currentTick && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[var(--accent-indigo)]/10 border border-[var(--accent-indigo)]/20">
              <svg className="animate-spin h-4 w-4 text-[var(--accent-indigo)]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm font-medium text-[var(--accent-indigo)]">Match in progress — waiting for data...</span>
            </div>
          </div>
        )}

        {/* Bot cards row */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card hover={false} className="border-l-4 border-l-[var(--accent-indigo)]">
              <p className="text-sm text-[var(--text-tertiary)]">{bot1.owner?.username ?? 'Unknown'}</p>
              <p className="text-lg font-bold font-[var(--font-display)] text-[var(--text-primary)]">
                {bot1.name}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)]">
                  ELO {bot1.elo ?? '---'}
                </span>
                {bot1.tier && <TierBadge tier={bot1.tier} size="sm" />}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card hover={false} className="border-r-4 border-r-[var(--accent-emerald)]">
              <p className="text-sm text-[var(--text-tertiary)]">{bot2.owner?.username ?? 'Unknown'}</p>
              <p className="text-lg font-bold font-[var(--font-display)] text-[var(--text-primary)]">
                {bot2.name}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)]">
                  ELO {bot2.elo ?? '---'}
                </span>
                {bot2.tier && <TierBadge tier={bot2.tier} size="sm" />}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Chart + Trade Feed */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* P&L Chart */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card hover={false} className="h-[360px]">
              <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Real-time P&L</p>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={pnlHistory}>
                  <XAxis
                    dataKey="elapsed"
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatDuration(v)}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '12px',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => `Time: ${formatDuration(v as number)}`}
                    formatter={(value: any, name: any) => [
                      formatPnl(Number(value)),
                      name === 'bot1' ? bot1.name : bot2.name,
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="bot1"
                    stroke="var(--accent-indigo)"
                    strokeWidth={2}
                    dot={false}
                    name="bot1"
                  />
                  <Line
                    type="monotone"
                    dataKey="bot2"
                    stroke="var(--accent-emerald)"
                    strokeWidth={2}
                    dot={false}
                    name="bot2"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Trade Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card hover={false} className="flex h-[360px] flex-col">
              <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Trade Feed</p>
              <div
                ref={tradeFeedRef}
                className="flex-1 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin"
              >
                {trades.length === 0 && (
                  <p className="py-8 text-center text-sm text-[var(--text-tertiary)]">
                    Waiting for trades...
                  </p>
                )}
                {trades.map((trade, i) => {
                  const isBot1 = trade.botId === bot1.id;
                  const botName = isBot1 ? bot1.name : bot2.name;
                  const isProfit = trade.pnl != null && trade.pnl > 0;
                  const isClose = trade.type === 'CLOSE';

                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-xs"
                    >
                      {/* Green/red indicator */}
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: isClose
                            ? isProfit
                              ? 'var(--accent-emerald)'
                              : 'var(--accent-red)'
                            : 'var(--accent-indigo)',
                        }}
                      />
                      <span className="truncate font-medium text-[var(--text-primary)]">
                        {botName}
                      </span>
                      <span className="text-[var(--text-tertiary)]">
                        {trade.type} {trade.side}
                      </span>
                      <span className="font-[var(--font-mono)] text-[var(--text-secondary)]">
                        {trade.symbol}
                      </span>
                      {trade.pnl != null && (
                        <span
                          className="ml-auto font-[var(--font-mono)] font-bold"
                          style={{
                            color: trade.pnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)',
                          }}
                        >
                          {formatPnl(trade.pnl)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Bottom bar: timer, spectators, prediction */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card hover={false}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Timer */}
              <div className="flex items-center gap-3">
                <LiveDot />
                <span className="font-[var(--font-mono)] text-2xl font-bold text-[var(--text-primary)]">
                  {formatDuration(remaining)}
                </span>
                <span className="text-sm text-[var(--text-tertiary)]">remaining</span>
              </div>

              {/* Spectators */}
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="font-[var(--font-mono)] text-sm">
                  {spectatorCount} watching
                </span>
              </div>

              {/* Prediction widget */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--text-secondary)]">Who will win?</span>
                <Button
                  variant={prediction === 'bot1' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setPrediction('bot1')}
                >
                  {bot1.name}
                </Button>
                <Button
                  variant={prediction === 'bot2' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setPrediction('bot2')}
                  className={
                    prediction === 'bot2'
                      ? 'bg-gradient-to-br from-[var(--accent-emerald)] to-emerald-600 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                      : ''
                  }
                >
                  {bot2.name}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
