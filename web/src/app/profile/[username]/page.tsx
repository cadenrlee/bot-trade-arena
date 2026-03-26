'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/ui/tier-badge';
import { StatCard } from '@/components/ui/stat-card';
import { cn, tierColor, tierGlow, timeAgo } from '@/lib/utils';

type Tab = 'arena' | 'performance' | 'posts';

function MiniEquityChart({ data }: { data: { date: string; equity: number }[] }) {
  if (!data || data.length < 2) return <p className="text-sm text-[var(--text-tertiary)]">Not enough data</p>;
  const values = data.map(d => d.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 400;
  const h = 120;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 10) - 5;
    return `${x},${y}`;
  });
  const up = values[values.length - 1] >= values[0];
  const color = up ? 'var(--accent-emerald)' : 'var(--accent-red)';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points.join(' ')} ${w},${h}`}
        fill="url(#eq-fill)"
      />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PostCard({ post, currentUserId, onLike, onDelete }: any) {
  const stats = post.statsSnapshot ? JSON.parse(post.statsSnapshot) : null;
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>(post.comments || []);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);

  const toggleLike = async () => {
    const res = await onLike(post.id);
    if (res) {
      setLiked(res.liked);
      setLikeCount((c: number) => res.liked ? c + 1 : c - 1);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    try {
      const c = await api.commentOnPost(post.id, commentText.trim());
      setComments((prev: any[]) => [...prev, { ...c, user: { username: 'you' } }]);
      setCommentText('');
    } catch { /* */ }
  };

  return (
    <Card hover={false} className="space-y-3">
      {/* Author */}
      <div className="flex items-center justify-between">
        <a href={`/profile/${post.user?.username}`} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center text-white text-sm font-bold">
            {(post.user?.username || '?')[0].toUpperCase()}
          </div>
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{post.user?.displayName || post.user?.username}</span>
            <div className="flex items-center gap-2">
              <TierBadge tier={post.user?.tier || 'Bronze'} size="sm" />
              <span className="text-xs text-[var(--text-tertiary)]">{timeAgo(post.createdAt)}</span>
            </div>
          </div>
        </a>
        {post.userId === currentUserId && (
          <button onClick={() => onDelete(post.id)} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-red)] cursor-pointer">Delete</button>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{post.content}</p>

      {/* Stats snapshot */}
      {stats && (
        <div className="rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Trading Stats Snapshot</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] text-[var(--text-tertiary)]">Equity</p>
              <p className="text-sm font-bold font-[var(--font-mono)]">${stats.equity?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-tertiary)]">Total P&L</p>
              <p className={cn('text-sm font-bold font-[var(--font-mono)]', stats.totalPnl >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]')}>
                {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl?.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-tertiary)]">Win Rate</p>
              <p className="text-sm font-bold font-[var(--font-mono)] text-[var(--accent-emerald)]">{stats.winRate?.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-tertiary)]">Profit Factor</p>
              <p className="text-sm font-bold font-[var(--font-mono)]">{stats.profitFactor?.toFixed(2)}</p>
            </div>
          </div>
          {stats.equityCurve && stats.equityCurve.length > 1 && (
            <MiniEquityChart data={stats.equityCurve} />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-1">
        <button onClick={toggleLike} className={cn('flex items-center gap-1.5 text-sm cursor-pointer transition-colors', liked ? 'text-[var(--accent-red)]' : 'text-[var(--text-tertiary)] hover:text-[var(--accent-red)]')}>
          {liked ? '\u2665' : '\u2661'} <span className="font-[var(--font-mono)]">{likeCount}</span>
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors">
          <span>💬</span> <span className="font-[var(--font-mono)]">{post.commentCount || comments.length}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="space-y-2 pt-2 border-t border-[var(--border-default)]">
          {comments.map((c: any, i: number) => (
            <div key={c.id || i} className="flex gap-2">
              <span className="text-xs font-semibold text-[var(--accent-indigo)]">{c.user?.username || 'anon'}</span>
              <span className="text-xs text-[var(--text-secondary)]">{c.content}</span>
            </div>
          ))}
          {currentUserId && (
            <div className="flex gap-2 mt-2">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Add a comment..."
                className="flex-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-[var(--text-primary)] outline-none"
              />
              <button onClick={submitComment} className="text-xs text-[var(--accent-indigo)] font-medium cursor-pointer">Post</button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const currentUser = useAuthStore((s) => s.user);

  const [profile, setProfile] = useState<any>(null);
  const [bots, setBots] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('arena');

  // Real performance
  const [alpacaStats, setAlpacaStats] = useState<any>(null);
  const [alpacaLoading, setAlpacaLoading] = useState(false);

  // Posts
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const isOwnProfile = currentUser?.username === username;

  const fetchProfile = useCallback(async () => {
    try {
      const [userData, userBots] = await Promise.all([
        api.getUser(username),
        api.getUserBots(username),
      ]);
      setProfile(userData);
      setBots(userBots || []);
      setFollowing(userData.isFollowing || false);

      if (isOwnProfile) {
        try {
          const ach = await api.getMyAchievements();
          setAchievements(ach || []);
        } catch { /* empty */ }
      }
    } catch { /* empty */ }
    setLoading(false);
  }, [username, isOwnProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Fetch Alpaca stats when performance tab is selected
  useEffect(() => {
    if (tab === 'performance' && !alpacaStats && !alpacaLoading) {
      setAlpacaLoading(true);
      api.getAlpacaProfile(username)
        .then(data => setAlpacaStats(data))
        .catch(() => setAlpacaStats({ connected: false }))
        .finally(() => setAlpacaLoading(false));
    }
  }, [tab, username, alpacaStats, alpacaLoading]);

  // Fetch posts when posts tab selected
  useEffect(() => {
    if (tab === 'posts' && posts.length === 0 && !postsLoading) {
      setPostsLoading(true);
      api.getUserPosts(username)
        .then(data => setPosts(Array.isArray(data) ? data : []))
        .catch(() => setPosts([]))
        .finally(() => setPostsLoading(false));
    }
  }, [tab, username, posts.length, postsLoading]);

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      if (following) {
        await api.unfollowUser(username);
        setFollowing(false);
        setProfile((p: any) => ({ ...p, followersCount: Math.max(0, (p.followersCount || 0) - 1) }));
      } else {
        await api.followUser(username);
        setFollowing(true);
        setProfile((p: any) => ({ ...p, followersCount: (p.followersCount || 0) + 1 }));
      }
    } catch { /* empty */ }
    setFollowLoading(false);
  };

  const handleLike = async (postId: string) => {
    try { return await api.likePost(postId); } catch { return null; }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await api.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch { /* */ }
  };

  if (loading) {
    return <div className="text-center py-20 text-[var(--text-tertiary)]">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="text-center py-20 text-[var(--text-secondary)]">User not found.</div>;
  }

  const winRate = profile.totalMatches > 0
    ? ((profile.totalWins / profile.totalMatches) * 100).toFixed(1)
    : '0.0';

  const xpForNextLevel = (profile.level || 1) * 1000;
  const currentXp = profile.xp || 0;
  const isPremiumTier = ['PLATINUM', 'DIAMOND'].includes((profile.tier || '').toUpperCase());

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hero Section */}
      <Card hover={false} className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(ellipse at top, ${tierColor(profile.tier || 'Bronze')}, transparent 70%)`,
          }}
        />
        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6 py-4">
          <div
            className={cn(
              'w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold font-[var(--font-display)] flex-shrink-0',
              isPremiumTier && tierGlow(profile.tier),
            )}
            style={{
              background: `linear-gradient(135deg, ${tierColor(profile.tier || 'Bronze')}, var(--bg-tertiary))`,
              border: `3px solid ${tierColor(profile.tier || 'Bronze')}`,
            }}
          >
            {(profile.displayName || profile.username || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <h1 className="text-2xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
                {profile.displayName || profile.username}
              </h1>
              <TierBadge tier={profile.tier || 'Bronze'} size="lg" showGlow={isPremiumTier} />
            </div>
            <p className="text-sm text-[var(--text-tertiary)] mt-0.5">@{profile.username}</p>
            <div className="flex items-center gap-6 mt-3 justify-center md:justify-start">
              <div>
                <span className="text-3xl font-bold font-[var(--font-mono)] text-[var(--text-primary)]">{profile.elo ?? 1000}</span>
                <span className="text-sm text-[var(--text-tertiary)] ml-2">ELO</span>
              </div>
              {(profile.streak ?? 0) > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-lg">&#128293;</span>
                  <span className="text-xl font-bold font-[var(--font-mono)] text-[var(--accent-amber)]">{profile.streak}</span>
                  <span className="text-xs text-[var(--text-tertiary)]">streak</span>
                </div>
              )}
              <div className="flex items-center gap-4 text-sm">
                <span>
                  <span className="font-bold text-[var(--text-primary)]">{profile.followersCount ?? 0}</span>
                  <span className="text-[var(--text-tertiary)] ml-1">followers</span>
                </span>
                <span>
                  <span className="font-bold text-[var(--text-primary)]">{profile.followingCount ?? 0}</span>
                  <span className="text-[var(--text-tertiary)] ml-1">following</span>
                </span>
              </div>
            </div>
            <div className="mt-3 max-w-xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)]">Season Level {profile.level || 1}</span>
                <span className="font-[var(--font-mono)] text-[var(--text-tertiary)]">{currentXp} / {xpForNextLevel} XP</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                <div className="h-full rounded-full score-bar" style={{
                  width: `${Math.min(100, (currentXp / xpForNextLevel) * 100)}%`,
                  background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-purple))',
                }} />
              </div>
            </div>
          </div>
          {!isOwnProfile && currentUser && (
            <Button variant={following ? 'secondary' : 'primary'} size="sm" onClick={handleFollow} loading={followLoading}>
              {following ? 'Unfollow' : 'Follow'}
            </Button>
          )}
        </div>
      </Card>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-xl p-1 border border-[var(--border-default)] w-fit">
        {([
          { key: 'arena', label: 'Arena Stats' },
          { key: 'performance', label: 'Real Performance' },
          { key: 'posts', label: 'Posts' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-5 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer',
              tab === t.key
                ? 'bg-[var(--accent-indigo)] text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== ARENA STATS TAB ===== */}
      {tab === 'arena' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Matches Played" value={profile.totalMatches ?? 0} />
            <StatCard label="Wins" value={profile.totalWins ?? 0} color="var(--accent-emerald)" />
            <StatCard label="Losses" value={profile.totalLosses ?? 0} color="var(--accent-red)" />
            <StatCard label="Win Rate" value={`${winRate}%`} color="var(--accent-emerald)" />
          </div>

          <Card hover={false}>
            <CardTitle className="mb-4">Achievements</CardTitle>
            {achievements.length === 0 && !isOwnProfile ? (
              <p className="text-sm text-[var(--text-tertiary)]">Achievements are private.</p>
            ) : achievements.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No achievements yet. Keep competing!</p>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {achievements.slice(0, 5).map((ach: any, i: number) => (
                  <div key={ach.id || i} className="flex flex-col items-center text-center p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)]">
                    <span className="text-2xl mb-1">{ach.icon || '&#127942;'}</span>
                    <span className="text-xs font-medium text-[var(--text-primary)]">{ach.name}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{ach.description}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card hover={false}>
            <CardTitle className="mb-4">Recent Matches</CardTitle>
            {(profile.recentMatches || []).length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No recent matches.</p>
            ) : (
              <div className="space-y-2">
                {(profile.recentMatches || []).slice(0, 10).map((match: any, i: number) => (
                  <div key={match.id || i} className="flex items-center justify-between rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded',
                        match.result === 'win'
                          ? 'bg-[rgba(16,185,129,0.15)] text-[var(--accent-emerald)]'
                          : match.result === 'draw'
                            ? 'bg-[rgba(100,116,139,0.15)] text-[var(--text-secondary)]'
                            : 'bg-[rgba(239,68,68,0.15)] text-[var(--accent-red)]'
                      )}>
                        {(match.result || 'loss').toUpperCase()}
                      </span>
                      <span className="text-sm text-[var(--text-primary)]">
                        vs <span className="font-medium">{match.opponentName || 'Unknown'}</span>
                      </span>
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">{match.createdAt ? timeAgo(match.createdAt) : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card hover={false}>
            <CardTitle className="mb-4">Bots</CardTitle>
            {bots.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No bots.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {bots.map((bot: any) => (
                  <a key={bot.id} href={`/bots/${bot.id}`} className="rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] p-4 hover:border-[var(--border-hover)] transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{bot.name}</span>
                      <span className="text-xs font-[var(--font-mono)] text-[var(--text-tertiary)]">{bot.language}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                      <span>ELO: <span className="font-bold font-[var(--font-mono)]">{bot.elo ?? '---'}</span></span>
                      <span>Matches: {bot.totalMatches ?? 0}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ===== REAL PERFORMANCE TAB ===== */}
      {tab === 'performance' && (
        <>
          {alpacaLoading ? (
            <div className="text-center py-16 text-[var(--text-tertiary)]">Loading real trading data...</div>
          ) : !alpacaStats || alpacaStats.connected === false ? (
            <Card hover={false} className="text-center py-16">
              <div className="text-4xl mb-4">📊</div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Brokerage Connected</h2>
              <p className="text-sm text-[var(--text-tertiary)] max-w-md mx-auto">
                {isOwnProfile
                  ? 'Connect your Alpaca account to show off your real trading performance.'
                  : "This trader hasn't connected their brokerage yet."}
              </p>
              {isOwnProfile && (
                <a href="/bots/connect">
                  <Button className="mt-4">Connect Alpaca</Button>
                </a>
              )}
            </Card>
          ) : (
            <>
              {/* Account Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Portfolio Equity" value={`$${alpacaStats.equity?.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                <StatCard
                  label="Today's P&L"
                  value={`${alpacaStats.todayPnl >= 0 ? '+' : ''}$${alpacaStats.todayPnl?.toFixed(2)}`}
                  color={alpacaStats.todayPnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'}
                />
                <StatCard
                  label="Total P&L"
                  value={`${alpacaStats.totalPnl >= 0 ? '+' : ''}$${alpacaStats.totalPnl?.toFixed(2)}`}
                  color={alpacaStats.totalPnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'}
                />
                <StatCard label="Buying Power" value={`$${alpacaStats.buyingPower?.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Total Trades" value={alpacaStats.totalTrades ?? 0} />
                <StatCard label="Win Rate" value={`${(alpacaStats.winRate ?? 0).toFixed(1)}%`} color="var(--accent-emerald)" />
                <StatCard label="Profit Factor" value={(alpacaStats.profitFactor ?? 0).toFixed(2)} color={alpacaStats.profitFactor >= 1 ? 'var(--accent-emerald)' : 'var(--accent-red)'} />
                <StatCard label="Avg Win" value={`$${(alpacaStats.avgWin ?? 0).toFixed(2)}`} color="var(--accent-emerald)" />
                <StatCard label="Avg Loss" value={`$${(alpacaStats.avgLoss ?? 0).toFixed(2)}`} color="var(--accent-red)" />
                <StatCard label="Best Trade" value={`$${(alpacaStats.bestTrade ?? 0).toFixed(2)}`} color="var(--accent-emerald)" />
              </div>

              {/* Equity Curve */}
              {alpacaStats.equityCurve && alpacaStats.equityCurve.length > 1 && (
                <Card hover={false}>
                  <CardTitle className="mb-4">Equity Curve (30 Days)</CardTitle>
                  <MiniEquityChart data={alpacaStats.equityCurve} />
                  <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-2 font-[var(--font-mono)]">
                    <span>{alpacaStats.equityCurve[0]?.date}</span>
                    <span>{alpacaStats.equityCurve[alpacaStats.equityCurve.length - 1]?.date}</span>
                  </div>
                </Card>
              )}

              {/* Top Symbols */}
              {alpacaStats.topSymbols && alpacaStats.topSymbols.length > 0 && (
                <Card hover={false}>
                  <CardTitle className="mb-4">Most Traded Symbols</CardTitle>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {alpacaStats.topSymbols.slice(0, 10).map((sym: any) => (
                      <div key={sym.symbol} className="rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] p-3 text-center">
                        <p className="text-sm font-bold font-[var(--font-mono)] text-[var(--accent-indigo)]">{sym.symbol}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{sym.trades} trades</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Recent Trades */}
              {alpacaStats.recentTrades && alpacaStats.recentTrades.length > 0 && (
                <Card hover={false}>
                  <CardTitle className="mb-4">Recent Trades</CardTitle>
                  <div className="overflow-x-auto">
                    <div className="grid grid-cols-[1fr_60px_60px_80px_80px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-default)]">
                      <span>Symbol</span>
                      <span>Side</span>
                      <span>Qty</span>
                      <span className="text-right">Price</span>
                      <span className="text-right">Time</span>
                    </div>
                    {alpacaStats.recentTrades.slice(0, 15).map((trade: any, i: number) => (
                      <div key={i} className="grid grid-cols-[1fr_60px_60px_80px_80px] gap-2 px-3 py-2 items-center border-b border-[var(--border-default)] last:border-0">
                        <span className="text-sm font-bold font-[var(--font-mono)] text-[var(--text-primary)]">{trade.symbol}</span>
                        <span className={cn('text-xs font-medium', trade.side === 'buy' ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]')}>
                          {trade.side?.toUpperCase()}
                        </span>
                        <span className="text-xs font-[var(--font-mono)] text-[var(--text-secondary)]">{trade.qty}</span>
                        <span className="text-xs font-[var(--font-mono)] text-[var(--text-primary)] text-right">${trade.price?.toFixed(2)}</span>
                        <span className="text-[10px] text-[var(--text-tertiary)] text-right">{trade.time ? timeAgo(trade.time) : ''}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* ===== POSTS TAB ===== */}
      {tab === 'posts' && (
        <>
          {postsLoading ? (
            <div className="text-center py-16 text-[var(--text-tertiary)]">Loading posts...</div>
          ) : posts.length === 0 ? (
            <Card hover={false} className="text-center py-16">
              <p className="text-lg text-[var(--text-secondary)]">No posts yet</p>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                {isOwnProfile ? 'Share your trading journey on the feed!' : 'This user hasn\'t posted yet.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {posts.map((post: any) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUser?.id}
                  onLike={handleLike}
                  onDelete={handleDeletePost}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
