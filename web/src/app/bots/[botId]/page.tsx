'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TierBadge } from '@/components/ui/tier-badge';
import { StatCard } from '@/components/ui/stat-card';
import { ConnectedDot, LiveDot, InactiveDot } from '@/components/ui/live-dot';
import { cn, formatEloChange, timeAgo } from '@/lib/utils';

const languageColors: Record<string, { bg: string; text: string }> = {
  Python: { bg: 'rgba(53, 114, 165, 0.2)', text: '#3572A5' },
  TypeScript: { bg: 'rgba(49, 120, 198, 0.2)', text: '#3178C6' },
  Go: { bg: 'rgba(0, 173, 216, 0.2)', text: '#00ADD8' },
  Rust: { bg: 'rgba(222, 165, 132, 0.2)', text: '#DEA584' },
  JavaScript: { bg: 'rgba(241, 224, 90, 0.2)', text: '#F1E05A' },
};

export default function BotDetailPage() {
  const params = useParams();
  const botId = params.botId as string;
  const user = useAuthStore((s) => s.user);

  const [bot, setBot] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', description: '' });

  const fetchData = useCallback(async () => {
    try {
      const [botData, matchData] = await Promise.all([
        api.getBot(botId),
        api.getMyMatches(),
      ]);
      setBot(botData);
      setMatches(
        (matchData || []).filter(
          (m: any) => m.bot1Id === botId || m.bot2Id === botId
        )
      );
      setEditData({ name: botData.name, description: botData.description || '' });
    } catch { /* empty */ }
    setLoading(false);
  }, [botId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await api.regenerateKey(botId);
      setBot((prev: any) => ({ ...prev, apiKey: res.apiKey }));
    } catch { /* empty */ }
    setRegenerating(false);
  };

  const handleCopy = () => {
    if (bot?.apiKey) {
      navigator.clipboard.writeText(bot.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    try {
      const updated = await api.updateBot(botId, editData);
      setBot((prev: any) => ({ ...prev, ...updated }));
      setEditing(false);
    } catch { /* empty */ }
  };

  if (loading) {
    return <div className="text-center py-20 text-[var(--text-tertiary)]">Loading bot...</div>;
  }

  if (!bot) {
    return <div className="text-center py-20 text-[var(--text-secondary)]">Bot not found.</div>;
  }

  const lang = languageColors[bot.language] || { bg: 'rgba(100,100,100,0.2)', text: '#999' };
  const winRate = bot.totalMatches > 0 ? ((bot.totalWins / bot.totalMatches) * 100).toFixed(1) : '0.0';

  // Mock ELO history for chart
  const eloHistory = bot.eloHistory || Array.from({ length: 20 }, (_, i) => ({
    match: i + 1,
    elo: 1000 + Math.floor(Math.random() * 400 - 100),
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div>
            {editing ? (
              <Input
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="text-2xl font-bold"
              />
            ) : (
              <h1 className="text-3xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
                {bot.name}
              </h1>
            )}
            <div className="flex items-center gap-3 mt-1">
              <span
                className="text-xs font-medium font-[var(--font-mono)] px-2 py-0.5 rounded-full"
                style={{ backgroundColor: lang.bg, color: lang.text }}
              >
                {bot.language}
              </span>
              {bot.tier && <TierBadge tier={bot.tier} size="sm" />}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit Bot</Button>
          )}
        </div>
      </div>

      {/* Description */}
      {editing ? (
        <Input
          label="Description"
          value={editData.description}
          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
        />
      ) : bot.description ? (
        <p className="text-sm text-[var(--text-secondary)]">{bot.description}</p>
      ) : null}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard label="ELO" value={bot.elo ?? '---'} color="var(--accent-indigo)" />
        <StatCard label="Total Matches" value={bot.totalMatches ?? 0} />
        <StatCard label="Wins" value={bot.totalWins ?? 0} color="var(--accent-emerald)" />
        <StatCard label="Losses" value={bot.totalLosses ?? 0} color="var(--accent-red)" />
        <StatCard label="Win Rate" value={`${winRate}%`} color="var(--accent-emerald)" />
        <StatCard label="Draws" value={bot.draws ?? 0} />
        <StatCard label="Avg Score" value={bot.avgScore != null ? `$${bot.avgScore.toFixed(2)}` : '---'} />
        <StatCard label="Best Score" value={bot.bestScore != null ? `$${bot.bestScore}` : '---'} color="var(--accent-amber)" />
        <StatCard label="Win Streak" value={bot.winStreak ?? 0} color="var(--accent-purple)" />
      </div>

      {/* Career ELO Chart */}
      <Card hover={false}>
        <CardTitle className="mb-4">Career ELO</CardTitle>
        <div className="h-64 w-full rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] flex items-end gap-[2px] p-4 overflow-hidden">
          {eloHistory.map((point: any, i: number) => {
            const min = Math.min(...eloHistory.map((p: any) => p.elo));
            const max = Math.max(...eloHistory.map((p: any) => p.elo));
            const range = max - min || 1;
            const height = ((point.elo - min) / range) * 100;
            return (
              <div
                key={i}
                className="flex-1 rounded-t transition-all duration-300"
                style={{
                  height: `${Math.max(4, height)}%`,
                  background: `linear-gradient(to top, var(--accent-indigo), var(--accent-purple))`,
                  opacity: 0.6 + (i / eloHistory.length) * 0.4,
                }}
                title={`Match ${point.match}: ${point.elo} ELO`}
              />
            );
          })}
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-2 text-center">
          Recharts AreaChart integration placeholder -- install recharts for full interactive chart
        </p>
      </Card>

      {/* Match History */}
      <Card hover={false}>
        <CardTitle className="mb-4">Recent Matches</CardTitle>
        {matches.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">No matches yet.</p>
        ) : (
          <div className="space-y-2">
            {matches.slice(0, 20).map((match: any) => {
              const isBot1 = match.bot1Id === botId;
              const opponentName = isBot1 ? match.bot2Name : match.bot1Name;
              const myScore = isBot1 ? match.bot1Score : match.bot2Score;
              const oppScore = isBot1 ? match.bot2Score : match.bot1Score;
              const isWin = myScore > oppScore;
              const isDraw = myScore === oppScore;
              const eloChange = isBot1 ? match.bot1EloChange : match.bot2EloChange;

              return (
                <div
                  key={match.id}
                  className="flex items-center justify-between rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded',
                        isWin
                          ? 'bg-[rgba(16,185,129,0.15)] text-[var(--accent-emerald)]'
                          : isDraw
                            ? 'bg-[rgba(100,116,139,0.15)] text-[var(--text-secondary)]'
                            : 'bg-[rgba(239,68,68,0.15)] text-[var(--accent-red)]'
                      )}
                    >
                      {isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                    </span>
                    <span className="text-sm text-[var(--text-primary)]">
                      vs <span className="font-medium">{opponentName || 'Unknown'}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-[var(--font-mono)] text-[var(--text-primary)]">
                      {myScore != null ? `$${myScore}` : '---'} / {oppScore != null ? `$${oppScore}` : '---'}
                    </span>
                    {eloChange != null && (
                      <span
                        className={cn(
                          'text-xs font-bold font-[var(--font-mono)]',
                          eloChange >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'
                        )}
                      >
                        {formatEloChange(eloChange)}
                      </span>
                    )}
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {match.createdAt ? timeAgo(match.createdAt) : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* API Key Management */}
      <Card hover={false}>
        <CardTitle className="mb-4">API Key</CardTitle>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Use this key to authenticate your bot with the match engine.
        </p>
        <div className="flex items-center gap-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-default)] px-4 py-3">
          <code className="flex-1 text-sm font-[var(--font-mono)] text-[var(--text-primary)] truncate">
            {showApiKey ? (bot.apiKey || 'No key generated') : '••••••••••••••••••••••••••••••••'}
          </code>
          <button
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            onClick={() => setShowApiKey(!showApiKey)}
          >
            {showApiKey ? 'Hide' : 'Show'}
          </button>
          <button
            className="text-xs text-[var(--accent-indigo)] hover:underline cursor-pointer"
            onClick={handleCopy}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="danger" size="sm" onClick={handleRegenerate} loading={regenerating}>
            Regenerate Key
          </Button>
        </div>
      </Card>
    </div>
  );
}
