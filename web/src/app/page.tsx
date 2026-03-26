'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { TierBadge } from '@/components/ui/tier-badge';
import { cn, tierColor, tierGlow, formatPnl, timeAgo } from '@/lib/utils';

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [health, setHealth] = useState<any>(null);
  const [quests, setQuests] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [season, setSeason] = useState<any>(null);

  useEffect(() => {
    api.getHealth().then(setHealth).catch(() => {});

    if (user) {
      api.request('/api/retention/quests').then((q: any) => {
        setQuests(Array.isArray(q) ? q : q?.quests || []);
      }).catch(() => {});

      api.getMyMatches().then((m: any) => {
        setRecentMatches(Array.isArray(m) ? m.slice(0, 3) : []);
      }).catch(() => {});

      api.getCurrentSeason().then(setSeason).catch(() => {});
    }
  }, [user]);

  const handleBattle = () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    router.push('/battle');
  };

  const btcPrice = health?.market?.btc
    ? `$${Number(health.market.btc).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : health?.status === 'ok' ? 'Live' : null;

  const liveMatches = health?.liveMatches ?? health?.activeMatches ?? null;
  const onlineFriends = health?.onlineFriends ?? null;

  // Season progress
  const seasonDaysLeft = season?.endDate
    ? Math.max(0, Math.ceil((new Date(season.endDate).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 min-h-screen flex flex-col gap-6">

      {/* ===== PLAYER CARD ===== */}
      {user ? (
        <Link href={`/profile/${user.username}`} className="block">
          <div
            className="relative p-5 rounded-2xl bg-[var(--bg-secondary)] border transition-all hover:border-[var(--border-hover)]"
            style={{
              borderColor: `color-mix(in srgb, ${tierColor(user.tier)} 40%, var(--border-default))`,
            }}
          >
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div
                className={cn('w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-black shrink-0', tierGlow(user.tier))}
                style={{
                  background: `linear-gradient(135deg, ${tierColor(user.tier)}, var(--accent-purple))`,
                  border: `2px solid ${tierColor(user.tier)}`,
                }}
              >
                {(user.username || '?')[0].toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-[var(--text-primary)] truncate">{user.displayName || user.username}</span>
                  <TierBadge tier={user.tier} size="sm" />
                </div>
                <div className="font-[family-name:var(--font-mono)] text-2xl font-black text-[var(--text-primary)] leading-none">
                  {user.elo ?? 1000}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-tertiary)]">
                  <span>{user.totalWins ?? 0}W / {user.totalLosses ?? 0}L</span>
                  {(user.streak ?? 0) > 0 && (
                    <span className="text-[var(--accent-amber)] font-bold">
                      <span className="mr-0.5">&#x1F525;</span>{user.streak}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div className="text-center pt-4">
          <h1 className="text-3xl font-black font-[family-name:var(--font-display)]">
            <span style={{ background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Bot Trade Arena
            </span>
          </h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">Pit your trading bot against others. 60s. Real markets.</p>
        </div>
      )}

      {/* ===== BIG BATTLE BUTTON ===== */}
      <div className="text-center">
        <button
          onClick={handleBattle}
          className="w-full max-w-md mx-auto block py-6 px-8 rounded-2xl text-2xl font-black font-[family-name:var(--font-display)] text-white cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_40px_rgba(99,102,241,0.3)]"
          style={{
            background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple))',
          }}
        >
          {user ? 'FIND BATTLE' : 'SIGN IN TO BATTLE'}
        </button>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-[var(--text-tertiary)]">
          {btcPrice && (
            <span className="font-[family-name:var(--font-mono)]">
              <span className="text-[var(--accent-amber)]">BTC</span> {btcPrice}
            </span>
          )}
          {btcPrice && <span>&#183;</span>}
          <span>60s Real Market Battle</span>
        </div>
      </div>

      {/* ===== QUICK ACTIONS ===== */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/social" className="group">
          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-center transition-all group-hover:border-[var(--border-hover)] group-hover:bg-[var(--bg-tertiary)]">
            <div className="text-2xl mb-1.5">&#x1F91D;</div>
            <div className="text-xs font-bold text-[var(--text-primary)]">Challenge</div>
            <div className="text-[10px] text-[var(--text-tertiary)]">Friend</div>
          </div>
        </Link>
        <Link href="/bots" className="group">
          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-center transition-all group-hover:border-[var(--border-hover)] group-hover:bg-[var(--bg-tertiary)]">
            <div className="text-2xl mb-1.5">&#x1F916;</div>
            <div className="text-xs font-bold text-[var(--text-primary)]">My Bots</div>
            <div className="text-[10px] text-[var(--text-tertiary)]">Manage</div>
          </div>
        </Link>
        <Link href="/bots/connect" className="group">
          <div className="relative p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--accent-purple)]/30 text-center transition-all group-hover:border-[var(--accent-purple)]/60 group-hover:bg-[var(--accent-purple)]/5">
            <span className="absolute top-1.5 right-1.5 text-[8px] font-bold bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] px-1.5 py-0.5 rounded">PRO</span>
            <div className="text-2xl mb-1.5">&#x1F3C6;</div>
            <div className="text-xs font-bold text-[var(--text-primary)]">Go Ranked</div>
            <div className="text-[10px] text-[var(--text-tertiary)]">Real ELO</div>
          </div>
        </Link>
      </div>

      {/* ===== DAILY QUESTS ===== */}
      {quests.length > 0 && (
        <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Daily Quests</h2>
            <span className="text-[10px] text-[var(--accent-amber)] font-bold">Complete all 3 for bonus!</span>
          </div>
          <div className="space-y-2.5">
            {quests.slice(0, 3).map((quest: any, i: number) => {
              const progress = quest.progress ?? 0;
              const target = quest.target ?? 1;
              const pct = Math.min(100, (progress / target) * 100);
              const done = pct >= 100;
              return (
                <div key={quest.id || i} className="flex items-center gap-3">
                  <span className="text-lg">{quest.emoji || ['&#x2694;', '&#x1F4B0;', '&#x1F525;'][i] || '&#x2B50;'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={cn('text-xs font-medium truncate', done ? 'text-[var(--accent-emerald)]' : 'text-[var(--text-primary)]')}>
                        {quest.title || quest.name || 'Quest'}
                      </span>
                      <span className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--text-tertiary)] ml-2 shrink-0">
                        {progress}/{target}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: done
                            ? 'var(--accent-emerald)'
                            : 'linear-gradient(90deg, var(--accent-indigo), var(--accent-purple))',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== LIVE ACTIVITY ===== */}
      <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
        <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">Live Activity</h2>
        <div className="flex items-center gap-4 mb-3 text-xs">
          {liveMatches != null && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-red)] animate-pulse" />
              <span className="text-[var(--text-secondary)]">
                <span className="font-[family-name:var(--font-mono)] font-bold text-[var(--text-primary)]">{liveMatches}</span> live matches
              </span>
            </div>
          )}
          {onlineFriends != null && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)]" />
              <span className="text-[var(--text-secondary)]">
                <span className="font-[family-name:var(--font-mono)] font-bold text-[var(--text-primary)]">{onlineFriends}</span> friends online
              </span>
            </div>
          )}
          {liveMatches == null && onlineFriends == null && (
            <span className="text-[var(--text-tertiary)]">Connecting to server...</span>
          )}
        </div>

        {/* Recent matches */}
        {recentMatches.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Recent Matches</p>
            {recentMatches.map((match: any) => {
              const won = match.won ?? (match.result === 'win');
              const pnl = match.myPnl ?? match.pnl ?? 0;
              return (
                <div key={match.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-[var(--bg-tertiary)]">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        color: won ? 'var(--accent-emerald)' : 'var(--accent-red)',
                        background: won ? 'color-mix(in srgb, var(--accent-emerald) 15%, transparent)' : 'color-mix(in srgb, var(--accent-red) 15%, transparent)',
                      }}
                    >
                      {won ? 'W' : 'L'}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      vs {match.opponent || match.opponentName || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-[family-name:var(--font-mono)] font-bold" style={{ color: pnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
                      {formatPnl(pnl)}
                    </span>
                    {match.timestamp && (
                      <span className="text-[10px] text-[var(--text-tertiary)]">{timeAgo(new Date(match.timestamp))}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== SEASON PROGRESS ===== */}
      {season && (
        <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">{season.name || 'Season'}</h2>
            {seasonDaysLeft != null && (
              <span className="text-[10px] text-[var(--text-tertiary)] font-[family-name:var(--font-mono)]">{seasonDaysLeft}d left</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--text-secondary)]">
              Lv {user?.level ?? 1}
            </span>
            <div className="flex-1 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple)] transition-all"
                style={{ width: `${user?.xp ? Math.min(100, ((user.xp % 500) / 500) * 100) : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--text-tertiary)]">
              {user?.xp ? user.xp % 500 : 0}/500 XP
            </span>
          </div>
        </div>
      )}

      {/* ===== SIGNED OUT CTA ===== */}
      {!user && (
        <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-center space-y-3">
          <p className="text-sm font-bold text-[var(--text-primary)]">Track your stats. Climb the ranks.</p>
          <p className="text-xs text-[var(--text-tertiary)]">Create a free account to save your progress and battle other players.</p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/auth/register"
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple))' }}
            >
              Sign Up Free
            </Link>
            <Link
              href="/auth/login"
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-[var(--text-secondary)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
