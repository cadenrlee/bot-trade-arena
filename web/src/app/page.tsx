'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { TierBadge } from '@/components/ui/tier-badge';
import { LiveDot } from '@/components/ui/live-dot';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';

interface LiveMatch {
  id: string;
  bot1: { name: string; tier: string };
  bot2: { name: string; tier: string };
  score1: number;
  score2: number;
  timeRemaining: number;
  spectatorCount: number;
}

function QuestRing({ progress, label }: { progress: number; label: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="var(--bg-tertiary)"
          strokeWidth="5"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="var(--accent-indigo)"
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x="36"
          y="38"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--text-primary)"
          fontSize="14"
          fontFamily="var(--font-mono)"
          fontWeight="700"
        >
          {progress}%
        </text>
      </svg>
      <span className="text-xs text-[var(--text-secondary)] text-center leading-tight max-w-[80px]">
        {label}
      </span>
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Home() {
  const { user } = useAuthStore();
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getLiveMatches()
      .then((matches) => setLiveMatches(matches))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Not logged in — hero section
  if (!user) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center gap-8 px-4 py-16 max-w-3xl mx-auto"
      >
        <h1
          className="text-4xl md:text-5xl font-bold text-center leading-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Bot Trade Arena
        </h1>
        <p className="text-lg text-[var(--text-secondary)] text-center max-w-lg">
          Build trading bots. Battle head-to-head. Climb the leaderboard. Watch live matches and see who dominates the market.
        </p>
        <div className="flex gap-4">
          <Link href="/auth/register">
            <Button size="lg">Get Started</Button>
          </Link>
          <Link href="/auth/login">
            <Button size="lg" variant="secondary">
              Sign In
            </Button>
          </Link>
        </div>

        {/* Live matches preview for visitors */}
        {liveMatches.length > 0 && (
          <div className="w-full mt-4">
            <h2
              className="text-lg font-semibold mb-3 flex items-center gap-2"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <LiveDot /> LIVE NOW
            </h2>
            <div className="flex flex-col gap-3">
              {liveMatches.slice(0, 3).map((match) => (
                <Link key={match.id} href={`/matches/${match.id}`}>
                  <Card className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <LiveDot />
                      <span className="font-medium">{match.bot1.name}</span>
                      <TierBadge tier={match.bot1.tier} size="sm" />
                      <span className="text-[var(--text-tertiary)] font-[var(--font-mono)] text-sm">
                        {match.score1} – {match.score2}
                      </span>
                      <TierBadge tier={match.bot2.tier} size="sm" />
                      <span className="font-medium">{match.bot2.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                      <span className="font-[var(--font-mono)]">{formatTime(match.timeRemaining)}</span>
                      <span className="flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        {match.spectatorCount}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // Logged-in home screen
  const streak = user.streak ?? 0;
  const xp = user.xp ?? 0;
  const level = user.level ?? 1;
  const xpForNext = level * 500;
  const xpProgress = Math.min((xp / xpForNext) * 100, 100);
  const winRate =
    user.totalMatches > 0
      ? Math.round((user.totalWins / user.totalMatches) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-6 px-4 py-6 max-w-3xl mx-auto w-full"
    >
      {/* Streak */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔥</span>
        <span
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {streak}-day streak
        </span>
      </div>

      {/* XP Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Level {level}</span>
          <span
            className="text-[var(--text-tertiary)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {xp} / {xpForNext} XP
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${xpProgress}%`,
              background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-purple))',
            }}
          />
        </div>
      </div>

      {/* Daily Quests */}
      <div>
        <h2
          className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Daily Quests
        </h2>
        <div className="flex justify-around">
          <QuestRing progress={66} label="Play 3 Matches" />
          <QuestRing progress={100} label="Win 1 Match" />
          <QuestRing progress={33} label="Spectate 3 Matches" />
        </div>
      </div>

      {/* Find a Match CTA */}
      <Link href="/matches/live">
        <button
          className="w-full py-4 rounded-2xl text-white text-lg font-bold cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
          style={{
            fontFamily: 'var(--font-display)',
            background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple))',
            boxShadow: '0 0 30px rgba(99, 102, 241, 0.35)',
          }}
        >
          FIND A MATCH
        </button>
      </Link>

      {/* Live Now */}
      <div>
        <h2
          className="text-lg font-semibold mb-3 flex items-center gap-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <LiveDot /> LIVE NOW
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--text-tertiary)]">Loading live matches...</p>
        ) : liveMatches.length === 0 ? (
          <Card hover={false}>
            <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
              No live matches right now. Start one!
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {liveMatches.map((match) => (
              <Link key={match.id} href={`/matches/${match.id}`}>
                <Card className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <LiveDot />
                    <span className="font-medium truncate">{match.bot1.name}</span>
                    <TierBadge tier={match.bot1.tier} size="sm" />
                    <span
                      className="text-[var(--text-tertiary)] text-sm shrink-0"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {match.score1} – {match.score2}
                    </span>
                    <TierBadge tier={match.bot2.tier} size="sm" />
                    <span className="font-medium truncate">{match.bot2.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)] shrink-0 ml-2">
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {formatTime(match.timeRemaining)}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      {match.spectatorCount}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Your Stats */}
      <div>
        <h2
          className="text-lg font-semibold mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          YOUR STATS
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Tier" value={user.tier} color={`var(--tier-${user.tier.toLowerCase()})`} />
          <StatCard label="Win Rate" value={`${winRate}%`} color="var(--accent-emerald)" />
          <StatCard label="Wins" value={user.totalWins} />
          <StatCard label="Rank" value={user.elo} prefix="#" />
        </div>
      </div>

      {/* Upcoming */}
      <div>
        <h2
          className="text-lg font-semibold mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          UPCOMING
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardTitle>Next Tournament</CardTitle>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Weekly Arena — Starts Saturday 8 PM UTC
            </p>
            <Link href="/tournaments">
              <Button size="sm" variant="secondary" className="mt-3">
                View Details
              </Button>
            </Link>
          </Card>
          <Card>
            <CardTitle>Daily Challenge</CardTitle>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Beat the benchmark bot to earn bonus XP.
            </p>
            <Link href="/challenges">
              <Button size="sm" variant="secondary" className="mt-3">
                Take Challenge
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
