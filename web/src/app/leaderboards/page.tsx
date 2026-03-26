'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/ui/tier-badge';
import { cn, formatEloChange } from '@/lib/utils';

type TopTab = 'arena' | 'performance';

const PERIODS = ['daily', 'weekly', 'monthly', 'season', 'all-time'] as const;
const PERIOD_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  season: 'Season',
  'all-time': 'All-Time',
};

const TIERS = ['All', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] as const;

const PERF_SORT_OPTIONS = [
  { value: 'totalPnl', label: 'Total P&L' },
  { value: 'winRate', label: 'Win Rate' },
  { value: 'profitFactor', label: 'Profit Factor' },
  { value: 'equity', label: 'Equity' },
  { value: 'todayPnl', label: "Today's P&L" },
] as const;

export default function LeaderboardsPage() {
  const user = useAuthStore((s) => s.user);
  const [topTab, setTopTab] = useState<TopTab>('arena');

  // Arena state
  const [period, setPeriod] = useState<string>('all-time');
  const [tier, setTier] = useState<string>('All');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Performance state
  const [perfSort, setPerfSort] = useState<string>('totalPnl');
  const [perfData, setPerfData] = useState<any[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getLeaderboard(period, {
        tier: tier === 'All' ? undefined : tier.toLowerCase(),
        page,
        limit: 25,
      });
      setData(res);
    } catch { /* empty */ }
    setLoading(false);
  }, [period, tier, page]);

  useEffect(() => {
    if (topTab === 'arena') fetchLeaderboard();
  }, [fetchLeaderboard, topTab]);

  useEffect(() => {
    setPage(1);
  }, [period, tier]);

  // Fetch performance leaderboard
  useEffect(() => {
    if (topTab === 'performance') {
      setPerfLoading(true);
      api.getPerformanceLeaderboard(perfSort)
        .then(res => setPerfData(Array.isArray(res) ? res : (res?.data || [])))
        .catch(() => setPerfData([]))
        .finally(() => setPerfLoading(false));
    }
  }, [topTab, perfSort]);

  const entries = Array.isArray(data) ? data : (data?.data || data?.entries || []);
  const totalPages = data?.pagination?.totalPages || data?.totalPages || 1;
  const myPosition = data?.myPosition;
  const climbToday = data?.climbToday;

  const isCurrentUser = (entry: any) =>
    user && (entry.userId === user.id || entry.username === user.username);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Rankings of the best trading bots in the arena.
          </p>
        </div>
        {topTab === 'arena' && climbToday != null && (
          <div className="text-right">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Today</p>
            <p
              className={cn(
                'text-lg font-bold font-[var(--font-mono)]',
                climbToday >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'
              )}
            >
              {climbToday >= 0 ? '+' : ''}{climbToday} positions
            </p>
          </div>
        )}
      </div>

      {/* Top-level Tab Switcher */}
      <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-xl p-1 border border-[var(--border-default)] w-fit">
        <button
          onClick={() => setTopTab('arena')}
          className={cn(
            'px-5 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer',
            topTab === 'arena'
              ? 'bg-[var(--accent-indigo)] text-white shadow-md'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          )}
        >
          Arena Rankings
        </button>
        <button
          onClick={() => setTopTab('performance')}
          className={cn(
            'px-5 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer',
            topTab === 'performance'
              ? 'bg-[var(--accent-indigo)] text-white shadow-md'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          )}
        >
          Real Performance
        </button>
      </div>

      {/* ===== ARENA RANKINGS TAB ===== */}
      {topTab === 'arena' && (
        <>
          {/* Period Tabs */}
          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-xl p-1 border border-[var(--border-default)] w-fit">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer',
                  period === p
                    ? 'bg-[var(--accent-indigo)] text-white shadow-md'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Tier Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {TIERS.map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full border transition-all cursor-pointer',
                  tier === t
                    ? 'bg-[var(--bg-tertiary)] border-[var(--border-hover)] text-[var(--text-primary)]'
                    : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Rankings Table */}
          <Card hover={false} className="overflow-hidden p-0">
            <div className="overflow-x-auto">
            {/* Table Header */}
            <div className="grid grid-cols-[40px_1fr_80px_70px] md:grid-cols-[60px_1fr_1fr_100px_100px_80px_80px] gap-2 px-3 md:px-5 py-3 text-xs uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-default)] bg-[var(--bg-secondary)] min-w-0">
              <span>Rank</span>
              <span>User</span>
              <span className="hidden md:inline">Bot</span>
              <span className="hidden md:inline">Tier</span>
              <span className="text-right">ELO</span>
              <span className="text-right">Win Rate</span>
              <span className="hidden md:inline text-right">Matches</span>
            </div>

            {loading ? (
              <div className="py-16 text-center text-[var(--text-tertiary)]">Loading rankings...</div>
            ) : entries.length === 0 ? (
              <div className="py-16 text-center text-[var(--text-tertiary)]">No entries found.</div>
            ) : (
              <div className="divide-y divide-[var(--border-default)]">
                {entries.map((entry: any, i: number) => {
                  const rank = (page - 1) * 25 + i + 1;
                  const isSelf = isCurrentUser(entry);
                  return (
                    <div
                      key={entry.id || i}
                      className={cn(
                        'grid grid-cols-[40px_1fr_80px_70px] md:grid-cols-[60px_1fr_1fr_100px_100px_80px_80px] gap-2 px-3 md:px-5 py-3 items-center transition-colors min-w-0',
                        isSelf
                          ? 'bg-[rgba(99,102,241,0.08)] shadow-[inset_0_0_30px_rgba(99,102,241,0.06)]'
                          : 'hover:bg-[var(--bg-secondary)]'
                      )}
                    >
                      <span className={cn(
                        'text-sm font-bold font-[var(--font-mono)]',
                        rank <= 3 ? 'text-[var(--accent-amber)]' : 'text-[var(--text-tertiary)]'
                      )}>
                        #{rank}
                      </span>
                      <a
                        href={`/profile/${entry.username}`}
                        className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-indigo)] transition-colors truncate"
                      >
                        {entry.displayName || entry.username}
                        {isSelf && <span className="ml-2 text-xs text-[var(--accent-indigo)]">(you)</span>}
                      </a>
                      <span className="hidden md:inline text-sm text-[var(--text-secondary)] truncate">
                        {entry.botName || '---'}
                      </span>
                      <span className="hidden md:inline">
                        {entry.tier && <TierBadge tier={entry.tier} size="sm" />}
                      </span>
                      <span className="text-sm font-bold font-[var(--font-mono)] text-[var(--text-primary)] text-right">
                        {entry.elo ?? '---'}
                      </span>
                      <span className="text-sm font-[var(--font-mono)] text-[var(--accent-emerald)] text-right">
                        {entry.winRate != null ? `${entry.winRate.toFixed(1)}%` : '---'}
                      </span>
                      <span className="hidden md:inline text-sm font-[var(--font-mono)] text-[var(--text-secondary)] text-right">
                        {entry.totalMatches ?? 0}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Your position pinned at bottom */}
            {myPosition && !entries.some((e: any) => isCurrentUser(e)) && (
              <div className="border-t-2 border-[var(--accent-indigo)] grid grid-cols-[40px_1fr_80px_70px] md:grid-cols-[60px_1fr_1fr_100px_100px_80px_80px] gap-2 px-3 md:px-5 py-3 items-center bg-[rgba(99,102,241,0.08)] min-w-0">
                <span className="text-sm font-bold font-[var(--font-mono)] text-[var(--accent-indigo)]">
                  #{myPosition.rank}
                </span>
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {user?.displayName || user?.username} <span className="text-xs text-[var(--accent-indigo)]">(you)</span>
                </span>
                <span className="hidden md:inline text-sm text-[var(--text-secondary)]">{myPosition.botName || '---'}</span>
                <span className="hidden md:inline">{myPosition.tier && <TierBadge tier={myPosition.tier} size="sm" />}</span>
                <span className="text-sm font-bold font-[var(--font-mono)] text-right">{myPosition.elo}</span>
                <span className="text-sm font-[var(--font-mono)] text-[var(--accent-emerald)] text-right">
                  {myPosition.winRate?.toFixed(1)}%
                </span>
                <span className="hidden md:inline text-sm font-[var(--font-mono)] text-[var(--text-secondary)] text-right">
                  {myPosition.totalMatches ?? 0}
                </span>
              </div>
            )}
            </div>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-[var(--text-secondary)] font-[var(--font-mono)] px-4">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}

      {/* ===== REAL PERFORMANCE TAB ===== */}
      {topTab === 'performance' && (
        <>
          {/* Sort Dropdown */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--text-secondary)]">Sort by:</span>
            <select
              value={perfSort}
              onChange={e => setPerfSort(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none cursor-pointer"
            >
              {PERF_SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Performance Table */}
          <Card hover={false} className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              {/* Header */}
              <div className="grid grid-cols-[40px_1fr_90px_90px_70px] md:grid-cols-[50px_1fr_1fr_100px_100px_80px_90px_70px] gap-2 px-3 md:px-5 py-3 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-default)] bg-[var(--bg-secondary)] min-w-0">
                <span>Rank</span>
                <span>User</span>
                <span className="hidden md:inline">Bot</span>
                <span className="text-right">Equity</span>
                <span className="text-right">Total P&L</span>
                <span className="text-right">Win Rate</span>
                <span className="hidden md:inline text-right">Profit Factor</span>
                <span className="hidden md:inline text-right">Trades</span>
              </div>

              {perfLoading ? (
                <div className="py-16 text-center text-[var(--text-tertiary)]">Loading performance data...</div>
              ) : perfData.length === 0 ? (
                <div className="py-16 text-center text-[var(--text-tertiary)]">No performance data available yet.</div>
              ) : (
                <div className="divide-y divide-[var(--border-default)]">
                  {perfData.map((entry: any, i: number) => {
                    const isSelf = isCurrentUser(entry);
                    return (
                      <div
                        key={entry.id || entry.username || i}
                        className={cn(
                          'grid grid-cols-[40px_1fr_90px_90px_70px] md:grid-cols-[50px_1fr_1fr_100px_100px_80px_90px_70px] gap-2 px-3 md:px-5 py-3 items-center transition-colors min-w-0',
                          isSelf
                            ? 'bg-[rgba(99,102,241,0.08)] shadow-[inset_0_0_30px_rgba(99,102,241,0.06)]'
                            : 'hover:bg-[var(--bg-secondary)]'
                        )}
                      >
                        <span className={cn(
                          'text-sm font-bold font-[var(--font-mono)]',
                          i < 3 ? 'text-[var(--accent-amber)]' : 'text-[var(--text-tertiary)]'
                        )}>
                          #{i + 1}
                        </span>
                        <a
                          href={`/profile/${entry.username}`}
                          className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-indigo)] transition-colors truncate"
                        >
                          {entry.displayName || entry.username}
                          {isSelf && <span className="ml-2 text-xs text-[var(--accent-indigo)]">(you)</span>}
                        </a>
                        <span className="hidden md:inline text-sm text-[var(--text-secondary)] truncate">
                          {entry.botName || '---'}
                        </span>
                        <span className="text-sm font-bold font-[var(--font-mono)] text-[var(--text-primary)] text-right">
                          ${entry.equity?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '---'}
                        </span>
                        <span className={cn(
                          'text-sm font-bold font-[var(--font-mono)] text-right',
                          (entry.totalPnl ?? 0) >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'
                        )}>
                          {(entry.totalPnl ?? 0) >= 0 ? '+' : ''}${entry.totalPnl?.toFixed(2) ?? '0.00'}
                        </span>
                        <span className="text-sm font-[var(--font-mono)] text-[var(--accent-emerald)] text-right">
                          {entry.winRate != null ? `${entry.winRate.toFixed(1)}%` : '---'}
                        </span>
                        <span className="hidden md:inline text-sm font-[var(--font-mono)] text-[var(--text-secondary)] text-right">
                          {entry.profitFactor != null ? entry.profitFactor.toFixed(2) : '---'}
                        </span>
                        <span className="hidden md:inline text-sm font-[var(--font-mono)] text-[var(--text-secondary)] text-right">
                          {entry.totalTrades ?? 0}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
