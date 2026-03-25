'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/ui/tier-badge';
import { StatCard } from '@/components/ui/stat-card';
import { ScoreBar } from '@/components/ui/score-bar';
import { cn, tierColor, tierGlow, timeAgo } from '@/lib/utils';

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

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      if (following) {
        await api.unfollowUser(username);
        setFollowing(false);
        setProfile((p: any) => ({ ...p, followers: Math.max(0, (p.followers || 0) - 1) }));
      } else {
        await api.followUser(username);
        setFollowing(true);
        setProfile((p: any) => ({ ...p, followers: (p.followers || 0) + 1 }));
      }
    } catch { /* empty */ }
    setFollowLoading(false);
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
        {/* Background gradient based on tier */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(ellipse at top, ${tierColor(profile.tier || 'Bronze')}, transparent 70%)`,
          }}
        />

        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6 py-4">
          {/* Avatar */}
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

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <h1 className="text-2xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
                {profile.displayName || profile.username}
              </h1>
              <TierBadge
                tier={profile.tier || 'Bronze'}
                size="lg"
                showGlow={isPremiumTier}
              />
            </div>
            <p className="text-sm text-[var(--text-tertiary)] mt-0.5">@{profile.username}</p>

            <div className="flex items-center gap-6 mt-3 justify-center md:justify-start">
              {/* ELO */}
              <div>
                <span className="text-3xl font-bold font-[var(--font-mono)] text-[var(--text-primary)]">
                  {profile.elo ?? 1000}
                </span>
                <span className="text-sm text-[var(--text-tertiary)] ml-2">ELO</span>
              </div>

              {/* Streak */}
              {(profile.streak ?? 0) > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-lg">&#128293;</span>
                  <span className="text-xl font-bold font-[var(--font-mono)] text-[var(--accent-amber)]">
                    {profile.streak}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">streak</span>
                </div>
              )}

              {/* Follow counts */}
              <div className="flex items-center gap-4 text-sm">
                <span>
                  <span className="font-bold text-[var(--text-primary)]">{profile.followers ?? 0}</span>
                  <span className="text-[var(--text-tertiary)] ml-1">followers</span>
                </span>
                <span>
                  <span className="font-bold text-[var(--text-primary)]">{profile.following ?? 0}</span>
                  <span className="text-[var(--text-tertiary)] ml-1">following</span>
                </span>
              </div>
            </div>

            {/* Season Level + XP */}
            <div className="mt-3 max-w-xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)]">
                  Season Level {profile.level || 1}
                </span>
                <span className="font-[var(--font-mono)] text-[var(--text-tertiary)]">
                  {currentXp} / {xpForNextLevel} XP
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                <div
                  className="h-full rounded-full score-bar"
                  style={{
                    width: `${Math.min(100, (currentXp / xpForNextLevel) * 100)}%`,
                    background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-purple))',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Follow button */}
          {!isOwnProfile && currentUser && (
            <Button
              variant={following ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleFollow}
              loading={followLoading}
            >
              {following ? 'Unfollow' : 'Follow'}
            </Button>
          )}
        </div>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Matches Played" value={profile.totalMatches ?? 0} />
        <StatCard label="Wins" value={profile.totalWins ?? 0} color="var(--accent-emerald)" />
        <StatCard label="Losses" value={profile.totalLosses ?? 0} color="var(--accent-red)" />
        <StatCard label="Win Rate" value={`${winRate}%`} color="var(--accent-emerald)" />
      </div>

      {/* Achievements Showcase */}
      <Card hover={false}>
        <CardTitle className="mb-4">Achievements</CardTitle>
        {achievements.length === 0 && !isOwnProfile ? (
          <p className="text-sm text-[var(--text-tertiary)]">Achievements are private.</p>
        ) : achievements.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No achievements yet. Keep competing!</p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {achievements.slice(0, 5).map((ach: any, i: number) => (
              <div
                key={ach.id || i}
                className="flex flex-col items-center text-center p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)]"
              >
                <span className="text-2xl mb-1">{ach.icon || '&#127942;'}</span>
                <span className="text-xs font-medium text-[var(--text-primary)]">{ach.name}</span>
                <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{ach.description}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Match History */}
      <Card hover={false}>
        <CardTitle className="mb-4">Recent Matches</CardTitle>
        {(profile.recentMatches || []).length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No recent matches.</p>
        ) : (
          <div className="space-y-2">
            {(profile.recentMatches || []).slice(0, 10).map((match: any, i: number) => (
              <div
                key={match.id || i}
                className="flex items-center justify-between rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-xs font-bold px-2 py-0.5 rounded',
                      match.result === 'win'
                        ? 'bg-[rgba(16,185,129,0.15)] text-[var(--accent-emerald)]'
                        : match.result === 'draw'
                          ? 'bg-[rgba(100,116,139,0.15)] text-[var(--text-secondary)]'
                          : 'bg-[rgba(239,68,68,0.15)] text-[var(--accent-red)]'
                    )}
                  >
                    {(match.result || 'loss').toUpperCase()}
                  </span>
                  <span className="text-sm text-[var(--text-primary)]">
                    vs <span className="font-medium">{match.opponentName || 'Unknown'}</span>
                  </span>
                </div>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {match.createdAt ? timeAgo(match.createdAt) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Bot Gallery */}
      <Card hover={false}>
        <CardTitle className="mb-4">Bots</CardTitle>
        {bots.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No bots.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bots.map((bot: any) => (
              <a
                key={bot.id}
                href={`/bots/${bot.id}`}
                className="rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] p-4 hover:border-[var(--border-hover)] transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{bot.name}</span>
                  <span className="text-xs font-[var(--font-mono)] text-[var(--text-tertiary)]">
                    {bot.language}
                  </span>
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
    </div>
  );
}
