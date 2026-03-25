'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatDuration, timeAgo } from '@/lib/utils';

const difficultyColors: Record<string, { bg: string; text: string }> = {
  easy: { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--accent-emerald)' },
  medium: { bg: 'rgba(245, 158, 11, 0.15)', text: 'var(--accent-amber)' },
  hard: { bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--accent-red)' },
  expert: { bg: 'rgba(139, 92, 246, 0.15)', text: 'var(--accent-purple)' },
};

function CountdownTimer({ targetTime }: { targetTime: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetTime).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Expired');
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(
        `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return (
    <span className="font-[var(--font-mono)] text-xl font-bold text-[var(--accent-amber)]">
      {remaining}
    </span>
  );
}

export default function ChallengesPage() {
  const user = useAuthStore((s) => s.user);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [daily, setDaily] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bots, setBots] = useState<any[]>([]);
  const [startModal, setStartModal] = useState<string | null>(null);
  const [selectedBot, setSelectedBot] = useState('');
  const [starting, setStarting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [challengeData, dailyData, botData] = await Promise.all([
        api.getChallenges(),
        api.getDailyChallenge().catch(() => null),
        user ? api.getBots() : Promise.resolve([]),
      ]);
      setChallenges(challengeData || []);
      setDaily(dailyData);
      setBots(botData || []);
    } catch { /* empty */ }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStart = async () => {
    if (!startModal || !selectedBot) return;
    setStarting(true);
    try {
      await api.startChallenge(startModal, selectedBot);
      setStartModal(null);
      setSelectedBot('');
      fetchData();
    } catch { /* empty */ }
    setStarting(false);
  };

  const available = challenges.filter((c) => c.status === 'available' || !c.status);
  const history = challenges.filter((c) => c.status === 'completed' || c.status === 'failed');

  if (loading) {
    return <div className="text-center py-20 text-[var(--text-tertiary)]">Loading challenges...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
          Challenges
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Test your bot against unique scenarios and earn rewards.
        </p>
      </div>

      {/* Featured Daily Challenge */}
      {daily && (
        <Card hover={false} className="relative overflow-hidden border-[var(--accent-amber)] border-opacity-30">
          <div
            className="absolute inset-0 opacity-5"
            style={{
              background: 'radial-gradient(ellipse at top right, var(--accent-amber), transparent 60%)',
            }}
          />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-amber)]">
                Daily Challenge
              </span>
              {daily.expiresAt && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-tertiary)]">Time remaining:</span>
                  <CountdownTimer targetTime={daily.expiresAt} />
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold font-[var(--font-display)] text-[var(--text-primary)] mb-1">
              {daily.name}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {daily.description}
            </p>
            <div className="flex items-center gap-4 mb-4">
              {daily.type && (
                <span className="text-xs font-[var(--font-mono)] text-[var(--text-tertiary)] uppercase">
                  {daily.type}
                </span>
              )}
              {daily.difficulty && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: (difficultyColors[daily.difficulty.toLowerCase()] || difficultyColors.medium).bg,
                    color: (difficultyColors[daily.difficulty.toLowerCase()] || difficultyColors.medium).text,
                  }}
                >
                  {daily.difficulty.toUpperCase()}
                </span>
              )}
              {daily.duration && (
                <span className="text-xs text-[var(--text-tertiary)]">
                  Duration: {typeof daily.duration === 'number' ? formatDuration(daily.duration) : daily.duration}
                </span>
              )}
              {daily.reward && (
                <span className="text-xs font-bold text-[var(--accent-amber)]">
                  Reward: {daily.reward}
                </span>
              )}
            </div>
            <Button onClick={() => setStartModal(daily.id)}>
              Accept Challenge
            </Button>
          </div>
        </Card>
      )}

      {/* Available Challenges Grid */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
          Available Challenges
        </h2>
        {available.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No challenges available right now. Check back later!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {available.map((challenge) => {
              const diff = difficultyColors[(challenge.difficulty || 'medium').toLowerCase()] || difficultyColors.medium;
              return (
                <Card key={challenge.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">
                      {challenge.name}
                    </h3>
                    {challenge.difficulty && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                        style={{ backgroundColor: diff.bg, color: diff.text }}
                      >
                        {challenge.difficulty}
                      </span>
                    )}
                  </div>

                  {challenge.description && (
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-3">
                      {challenge.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                    {challenge.type && (
                      <span className="font-[var(--font-mono)] uppercase">{challenge.type}</span>
                    )}
                    {challenge.duration && (
                      <span>
                        {typeof challenge.duration === 'number' ? formatDuration(challenge.duration) : challenge.duration}
                      </span>
                    )}
                  </div>

                  <Button size="sm" onClick={() => setStartModal(challenge.id)}>
                    Start
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Challenge History */}
      {history.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-tertiary)] mb-3">
            Challenge History
          </h2>
          <div className="space-y-2">
            {history.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center justify-between rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-xs font-bold px-2 py-0.5 rounded',
                      ch.status === 'completed'
                        ? 'bg-[rgba(16,185,129,0.15)] text-[var(--accent-emerald)]'
                        : 'bg-[rgba(239,68,68,0.15)] text-[var(--accent-red)]'
                    )}
                  >
                    {ch.status === 'completed' ? 'PASSED' : 'FAILED'}
                  </span>
                  <span className="text-sm text-[var(--text-primary)]">{ch.name}</span>
                </div>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {ch.completedAt ? timeAgo(ch.completedAt) : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bot Selection Modal */}
      {startModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card hover={false} className="w-full max-w-md">
            <CardTitle className="mb-4">Select a Bot</CardTitle>
            {bots.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                You need to create a bot first.
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {bots.map((bot) => (
                  <button
                    key={bot.id}
                    onClick={() => setSelectedBot(bot.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-xl border transition-all cursor-pointer',
                      selectedBot === bot.id
                        ? 'border-[var(--accent-indigo)] bg-[rgba(99,102,241,0.1)]'
                        : 'border-[var(--border-default)] hover:border-[var(--border-hover)]'
                    )}
                  >
                    <span className="text-sm font-medium text-[var(--text-primary)]">{bot.name}</span>
                    <span className="text-xs text-[var(--text-tertiary)] ml-2">{bot.language}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setStartModal(null); setSelectedBot(''); }}>
                Cancel
              </Button>
              {bots.length > 0 && (
                <Button onClick={handleStart} loading={starting} disabled={!selectedBot}>
                  Start Challenge
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
