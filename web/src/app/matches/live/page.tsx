'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/ui/tier-badge';
import { LiveDot } from '@/components/ui/live-dot';
import { formatDuration, formatPnl } from '@/lib/utils';

interface LiveMatch {
  id: string;
  bot1: { id: string; name: string };
  bot2: { id: string; name: string };
  tier: string;
  scores: { bot1: number; bot2: number };
  remaining: number;
  spectators: number;
}

const AI_DIFFICULTIES = [
  { id: 'ROOKIE', name: 'Rookie Bot', desc: 'Easy — good for your first match', elo: 900, color: 'var(--accent-emerald)' },
  { id: 'VETERAN', name: 'Veteran Bot', desc: 'Medium — trades with discipline', elo: 1300, color: 'var(--accent-amber)' },
  { id: 'ELITE', name: 'Elite Bot', desc: 'Hard — aggressive and smart', elo: 1700, color: 'var(--accent-purple)' },
];

export default function LiveMatchesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [bots, setBots] = useState<any[]>([]);
  const [selectedBot, setSelectedBot] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('ROOKIE');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function fetchLiveMatches() {
      try {
        const data = await api.getLiveMatches();
        if (mounted) setMatches(Array.isArray(data) ? data : []);
      } catch {
        // silently handle
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchLiveMatches();
    const interval = setInterval(fetchLiveMatches, 5000);

    // Fetch user's bots
    if (user) {
      api.getBots().then((b) => {
        const botList = Array.isArray(b) ? b : (b as any)?.data || [];
        setBots(botList);
        if (botList.length > 0) setSelectedBot(botList[0].id);
      }).catch(() => {});
    }

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user]);

  const startVsAI = async () => {
    if (!selectedBot) { setError('Select a bot first'); return; }
    setStarting(true);
    setError('');
    try {
      const res = await api.request<any>('/api/matches/vs-ai', {
        method: 'POST',
        body: JSON.stringify({ botId: selectedBot, difficulty: selectedDifficulty }),
      });
      if (res.matchId) {
        router.push(`/matches/${res.matchId}`);
      } else {
        setError(res.error || 'Failed to start match');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start match');
    }
    setStarting(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Play vs AI — simplified */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            {bots.length === 0 ? (
              <Card hover={false} className="p-8 text-center">
                <h2 className="text-xl font-bold font-[var(--font-display)] mb-2">You need a bot first</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-5">
                  Create one in 10 seconds — no coding required.
                </p>
                <div className="flex gap-3 justify-center">
                  <Link href="/bots/templates">
                    <Button size="lg">Build a Bot (No Code)</Button>
                  </Link>
                  <Link href="/bots">
                    <Button size="lg" variant="secondary">Connect My Own Bot</Button>
                  </Link>
                </div>
              </Card>
            ) : (
              <Card hover={false} className="p-6">
                {/* One-click start */}
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold font-[var(--font-display)] mb-1">Ready to compete?</h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Pick your bot and an opponent difficulty. Match starts instantly.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={startVsAI}
                    loading={starting}
                    className="whitespace-nowrap text-lg px-10 py-4"
                  >
                    Start Match
                  </Button>
                </div>

                {/* Bot + Difficulty row */}
                <div className="mt-5 flex flex-wrap gap-4 items-center">
                  {/* Your bot */}
                  <div className="flex items-center gap-3 bg-[var(--bg-primary)] rounded-xl px-4 py-3 border border-[var(--border-default)]">
                    <span className="text-xs text-[var(--text-tertiary)] uppercase">Your bot:</span>
                    {bots.length === 1 ? (
                      <span className="font-semibold">{bots[0].name}</span>
                    ) : (
                      <select
                        className="bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
                        value={selectedBot}
                        onChange={(e) => setSelectedBot(e.target.value)}
                      >
                        {bots.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <span className="text-[var(--text-tertiary)] font-bold">VS</span>

                  {/* Difficulty pills */}
                  {AI_DIFFICULTIES.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDifficulty(d.id)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer border ${
                        selectedDifficulty === d.id
                          ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 text-[var(--text-primary)]'
                          : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
                      }`}
                    >
                      {d.name}
                      <span className="ml-2 font-[var(--font-mono)] text-xs" style={{ color: d.color }}>~{d.elo}</span>
                    </button>
                  ))}
                </div>

                {error && <p className="mt-3 text-sm text-[var(--accent-red)]">{error}</p>}
              </Card>
            )}
          </motion.div>
        )}

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <LiveDot className="w-3 h-3" />
          <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">
            Live Matches
          </h1>
          {!loading && (
            <span className="rounded-full bg-[var(--bg-tertiary)] px-3 py-0.5 text-sm font-[var(--font-mono)] text-[var(--text-secondary)]">
              {matches.length}
            </span>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <svg className="animate-spin h-8 w-8 text-[var(--accent-indigo)]" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Empty state */}
        {!loading && matches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 text-5xl opacity-30">&#9878;</div>
            <p className="text-lg text-[var(--text-secondary)]">
              No live matches right now. Check back soon or start one!
            </p>
          </div>
        )}

        {/* Match grid */}
        {!loading && matches.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((match, i) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.07 }}
              >
                <Link href={`/matches/${match.id}`}>
                  <Card className="group cursor-pointer relative overflow-hidden">
                    {/* Live indicator */}
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LiveDot />
                        <span className="text-xs font-medium uppercase tracking-wider text-[var(--accent-red)]">
                          Live
                        </span>
                      </div>
                      <TierBadge tier={match.tier} size="sm" />
                    </div>

                    {/* Bot names */}
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {match.bot1.name}
                      </span>
                      <span className="shrink-0 text-xs font-bold text-[var(--text-tertiary)]">VS</span>
                      <span className="truncate text-right text-sm font-semibold text-[var(--text-primary)]">
                        {match.bot2.name}
                      </span>
                    </div>

                    {/* Scores */}
                    <div className="mb-4 flex items-center justify-between">
                      <span className="font-[var(--font-mono)] text-lg font-bold text-[var(--accent-indigo)]">
                        {formatPnl((match as any).bot1Score ?? (match as any).scores?.bot1 ?? 0)}
                      </span>
                      <span className="font-[var(--font-mono)] text-lg font-bold text-[var(--accent-emerald)]">
                        {formatPnl((match as any).bot2Score ?? (match as any).scores?.bot2 ?? 0)}
                      </span>
                    </div>

                    {/* Footer: time remaining + spectators */}
                    <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-3">
                      <span className="font-[var(--font-mono)] text-sm text-[var(--text-secondary)]">
                        {formatDuration((match as any).remaining ?? (match as any).duration ?? 0)}
                      </span>
                      <div className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)]">
                        {/* Eye icon */}
                        <svg
                          width="16"
                          height="16"
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
                        <span className="font-[var(--font-mono)]">{(match as any).spectators ?? 0}</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
