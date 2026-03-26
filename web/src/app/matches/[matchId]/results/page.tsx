'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { TierBadge } from '@/components/ui/tier-badge';
import { ScoreBar } from '@/components/ui/score-bar';
import { Button } from '@/components/ui/button';
import { formatPnl, formatEloChange } from '@/lib/utils';

interface MatchResult {
  id: string;
  bot1: {
    id: string;
    name: string;
    owner: { username: string };
    elo: number;
    tier: string;
  };
  bot2: {
    id: string;
    name: string;
    owner: { username: string };
    elo: number;
    tier: string;
  };
  winnerId: string | null;
  scores: {
    bot1: {
      pnl: number;
      profitFactor: number;
      sharpe: number;
      risk: number;
      winRate: number;
      penalties: number;
      total: number;
    };
    bot2: {
      pnl: number;
      profitFactor: number;
      sharpe: number;
      risk: number;
      winRate: number;
      penalties: number;
      total: number;
    };
  };
  eloChanges: { bot1: number; bot2: number };
  streak?: number;
  questCompleted?: { name: string; xp: number } | null;
  achievementUnlocked?: { name: string; icon: string; description: string } | null;
}

function AnimatedCounter({
  target,
  duration = 1500,
  prefix = '',
}: {
  target: number;
  duration?: number;
  prefix?: string;
}) {
  const [value, setValue] = useState(0);
  const ref = useRef<ReturnType<typeof requestAnimationFrame>>(undefined);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));

      if (progress < 1) {
        ref.current = requestAnimationFrame(tick);
      }
    }

    ref.current = requestAnimationFrame(tick);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [target, duration]);

  return (
    <span>
      {prefix}
      {target >= 0 ? '+' : ''}
      {value}
    </span>
  );
}

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function MatchResultsPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await api.getMatch(matchId);
        if (mounted) setMatch(data);
      } catch {
        // handle error silently
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [matchId]);

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

  if (!match) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <p className="text-[var(--text-secondary)]">Match not found.</p>
      </div>
    );
  }

  const { bot1, bot2, scores, eloChanges, winnerId } = match;
  const bot1Won = winnerId === bot1.id;
  const isDraw = winnerId == null;

  const scoreMetrics: {
    label: string;
    key: keyof typeof scores.bot1;
    max: number;
  }[] = [
    { label: 'P&L', key: 'pnl', max: 100 },
    { label: 'Profit Factor', key: 'profitFactor', max: 30 },
    { label: 'Sharpe Ratio', key: 'sharpe', max: 25 },
    { label: 'Risk Management', key: 'risk', max: 20 },
    { label: 'Win Rate', key: 'winRate', max: 15 },
    { label: 'Penalties', key: 'penalties', max: 10 },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-10 sm:px-6 lg:px-8">
      <motion.div
        className="mx-auto max-w-3xl space-y-8"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {/* Victory / Defeat / Draw header */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 18,
            delay: 0.15,
          }}
        >
          {isDraw ? (
            <h1 className="font-[var(--font-display)] text-6xl font-black tracking-tight text-[var(--text-secondary)]">
              DRAW
            </h1>
          ) : (
            <>
              <h1
                className="font-[var(--font-display)] text-6xl font-black tracking-tight"
                style={{
                  background: bot1Won
                    ? 'linear-gradient(to right, var(--accent-indigo), var(--accent-purple))'
                    : 'linear-gradient(to right, var(--accent-emerald), var(--accent-teal, var(--accent-emerald)))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                VICTORY!
              </h1>
              <p className="mt-2 text-lg text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">
                  {bot1Won ? bot1.name : bot2.name}
                </span>{' '}
                wins the match
              </p>
            </>
          )}
        </motion.div>

        {/* Two bot result cards */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4">
          <Card
            hover={false}
            className={
              bot1Won && !isDraw
                ? 'ring-2 ring-[var(--accent-indigo)] border-[var(--accent-indigo)]'
                : ''
            }
          >
            <div className="text-center">
              {bot1Won && !isDraw && (
                <span className="mb-2 inline-block text-2xl">&#127942;</span>
              )}
              <p className="text-sm text-[var(--text-tertiary)]">{bot1.owner?.username}</p>
              <p className="text-lg font-bold font-[var(--font-display)] text-[var(--text-primary)]">
                {bot1.name}
              </p>
              {bot1.tier && <TierBadge tier={bot1.tier} size="sm" />}
              <p className="mt-3 font-[var(--font-mono)] text-2xl font-bold text-[var(--accent-indigo)]">
                {scores.bot1.total}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">points</p>
            </div>
          </Card>

          <Card
            hover={false}
            className={
              !bot1Won && !isDraw
                ? 'ring-2 ring-[var(--accent-emerald)] border-[var(--accent-emerald)]'
                : ''
            }
          >
            <div className="text-center">
              {!bot1Won && !isDraw && (
                <span className="mb-2 inline-block text-2xl">&#127942;</span>
              )}
              <p className="text-sm text-[var(--text-tertiary)]">{bot2.owner?.username}</p>
              <p className="text-lg font-bold font-[var(--font-display)] text-[var(--text-primary)]">
                {bot2.name}
              </p>
              {bot2.tier && <TierBadge tier={bot2.tier} size="sm" />}
              <p className="mt-3 font-[var(--font-mono)] text-2xl font-bold text-[var(--accent-emerald)]">
                {scores.bot2.total}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">points</p>
            </div>
          </Card>
        </motion.div>

        {/* Score breakdown */}
        <motion.div variants={fadeUp}>
          <Card hover={false}>
            <p className="mb-4 text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Score Breakdown
            </p>
            <div className="space-y-5">
              {scoreMetrics.map((metric) => (
                <div key={metric.key} className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
                  <ScoreBar
                    label={`${bot1.name}`}
                    value={scores.bot1[metric.key]}
                    max={metric.max}
                    color="var(--accent-indigo)"
                  />
                  <span className="pb-1 text-xs font-medium text-[var(--text-tertiary)] text-center min-w-[80px]">
                    {metric.label}
                  </span>
                  <ScoreBar
                    label={`${bot2.name}`}
                    value={scores.bot2[metric.key]}
                    max={metric.max}
                    color="var(--accent-emerald)"
                  />
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* ELO changes */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4">
          <Card hover={false} className="text-center">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              ELO Change
            </p>
            <p
              className="font-[var(--font-mono)] text-3xl font-bold"
              style={{
                color:
                  eloChanges.bot1 >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)',
              }}
            >
              <AnimatedCounter target={eloChanges.bot1} />
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{bot1.name}</p>
          </Card>

          <Card hover={false} className="text-center">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              ELO Change
            </p>
            <p
              className="font-[var(--font-mono)] text-3xl font-bold"
              style={{
                color:
                  eloChanges.bot2 >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)',
              }}
            >
              <AnimatedCounter target={eloChanges.bot2} />
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{bot2.name}</p>
          </Card>
        </motion.div>

        {/* Streak */}
        {match.streak && match.streak > 1 && (
          <motion.div variants={fadeUp}>
            <Card hover={false} className="text-center border-[var(--accent-amber,var(--accent-indigo))]">
              <p className="text-3xl mb-1">&#128293;</p>
              <p className="font-[var(--font-display)] text-lg font-bold text-[var(--text-primary)]">
                {match.streak} Win Streak!
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Keep dominating the arena
              </p>
            </Card>
          </motion.div>
        )}

        {/* Quest completed */}
        {match.questCompleted && (
          <motion.div variants={fadeUp}>
            <Card hover={false} className="border-[var(--accent-emerald)] bg-[color-mix(in_srgb,var(--accent-emerald)_5%,var(--bg-card))]">
              <div className="flex items-center gap-4">
                <span className="text-3xl">&#9989;</span>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">
                    Quest Completed!
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {match.questCompleted.name}
                  </p>
                </div>
                <span className="ml-auto font-[var(--font-mono)] text-lg font-bold text-[var(--accent-emerald)]">
                  +{match.questCompleted.xp} XP
                </span>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Achievement unlocked */}
        {match.achievementUnlocked && (
          <motion.div
            variants={fadeUp}
            className="overflow-hidden rounded-2xl"
          >
            <div
              className="relative p-5"
              style={{
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--accent-indigo) 20%, var(--bg-card)), color-mix(in srgb, var(--accent-purple) 20%, var(--bg-card)))',
                border: '1px solid var(--accent-indigo)',
                borderRadius: '1rem',
              }}
            >
              <div className="flex items-center gap-4">
                <span className="text-4xl">{match.achievementUnlocked.icon}</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent-indigo)]">
                    Achievement Unlocked
                  </p>
                  <p className="font-[var(--font-display)] text-xl font-bold text-[var(--text-primary)]">
                    {match.achievementUnlocked.name}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {match.achievementUnlocked.description}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-8"
        >
          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.push(`/matches/${matchId}`)}
          >
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
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Watch Replay
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              const shareUrl = `${window.location.origin}/matches/${matchId}/results`;
              navigator.clipboard?.writeText(shareUrl).then(() => {
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
              });
            }}
          >
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
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            {shareCopied ? 'Copied!' : 'Share'}
          </Button>

          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push('/matches/live')}
          >
            Play Again
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
