'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/ui/tier-badge';
import { cn, formatEloChange, timeAgo } from '@/lib/utils';

interface BracketMatch {
  id: string;
  round: number;
  position: number;
  bot1Name?: string;
  bot2Name?: string;
  bot1Score?: number;
  bot2Score?: number;
  winnerId?: string;
  bot1Id?: string;
  bot2Id?: string;
  status?: string;
}

function BracketMatchCard({ match }: { match: BracketMatch }) {
  const bot1Won = match.winnerId && match.winnerId === match.bot1Id;
  const bot2Won = match.winnerId && match.winnerId === match.bot2Id;

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden w-56">
      {/* Bot 1 */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)]',
          bot1Won && 'bg-[rgba(16,185,129,0.08)]'
        )}
      >
        <span className={cn(
          'text-sm truncate',
          bot1Won ? 'font-bold text-[var(--accent-emerald)]' : 'text-[var(--text-primary)]'
        )}>
          {match.bot1Name || 'TBD'}
        </span>
        <span className="text-sm font-[var(--font-mono)] text-[var(--text-secondary)]">
          {match.bot1Score != null ? match.bot1Score : '-'}
        </span>
      </div>
      {/* Bot 2 */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2',
          bot2Won && 'bg-[rgba(16,185,129,0.08)]'
        )}
      >
        <span className={cn(
          'text-sm truncate',
          bot2Won ? 'font-bold text-[var(--accent-emerald)]' : 'text-[var(--text-primary)]'
        )}>
          {match.bot2Name || 'TBD'}
        </span>
        <span className="text-sm font-[var(--font-mono)] text-[var(--text-secondary)]">
          {match.bot2Score != null ? match.bot2Score : '-'}
        </span>
      </div>
    </div>
  );
}

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getTournament(tournamentId);
      setTournament(data);
    } catch { /* empty */ }
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="text-center py-20 text-[var(--text-tertiary)]">Loading tournament...</div>;
  }

  if (!tournament) {
    return <div className="text-center py-20 text-[var(--text-secondary)]">Tournament not found.</div>;
  }

  const isActive = tournament.status === 'active' || tournament.status === 'in_progress';
  const bracketMatches: BracketMatch[] = tournament.bracket || tournament.matches || [];
  const participants: any[] = tournament.participants || [];

  // Group bracket matches by round
  const rounds: Map<number, BracketMatch[]> = new Map();
  bracketMatches.forEach((m) => {
    const round = m.round ?? 1;
    if (!rounds.has(round)) rounds.set(round, []);
    rounds.get(round)!.push(m);
  });
  const sortedRounds = Array.from(rounds.entries()).sort(([a], [b]) => a - b);

  const roundNames = (total: number, idx: number): string => {
    if (idx === total - 1) return 'Final';
    if (idx === total - 2) return 'Semifinal';
    if (idx === total - 3) return 'Quarterfinal';
    return `Round ${idx + 1}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
              {tournament.name}
            </h1>
            {isActive && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[rgba(239,68,68,0.15)] text-[var(--accent-red)]">
                LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-[var(--text-tertiary)] font-[var(--font-mono)] uppercase">
              {tournament.format || 'Single Elimination'}
            </span>
            {tournament.tier && <TierBadge tier={tournament.tier} size="sm" />}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => window.location.href = '/tournaments'}>
          Back to Tournaments
        </Button>
      </div>

      {/* Info Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] p-4">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Entry Fee</p>
          <p className="text-xl font-bold font-[var(--font-mono)] text-[var(--text-primary)]">
            {tournament.entryFee ? `$${tournament.entryFee}` : 'Free'}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] p-4">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Prize Pool</p>
          <p className="text-xl font-bold font-[var(--font-mono)] text-[var(--accent-amber)]">
            {tournament.prizePool ? `$${tournament.prizePool}` : '---'}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] p-4">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Entrants</p>
          <p className="text-xl font-bold font-[var(--font-mono)] text-[var(--text-primary)]">
            {tournament.entrants ?? participants.length}
            {tournament.maxEntrants ? ` / ${tournament.maxEntrants}` : ''}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] p-4">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Status</p>
          <p className="text-xl font-bold font-[var(--font-mono)] text-[var(--text-primary)] capitalize">
            {tournament.status || 'unknown'}
          </p>
        </div>
      </div>

      {/* Bracket Visualization */}
      <Card hover={false}>
        <CardTitle className="mb-4">Bracket</CardTitle>
        {sortedRounds.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-8">
            Bracket will be available once the tournament starts.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex gap-8 min-w-max py-4">
              {sortedRounds.map(([round, matches], idx) => (
                <div key={round} className="flex flex-col items-center gap-6">
                  <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                    {roundNames(sortedRounds.length, idx)}
                  </h3>
                  <div className="flex flex-col gap-4 justify-around flex-1">
                    {matches
                      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                      .map((match) => (
                        <BracketMatchCard key={match.id} match={match} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Participants */}
      <Card hover={false}>
        <CardTitle className="mb-4">
          Participants ({participants.length})
        </CardTitle>
        {participants.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No participants yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {participants.map((p: any, i: number) => (
              <div
                key={p.id || i}
                className="flex items-center gap-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] px-4 py-3"
              >
                <span className="text-xs font-bold font-[var(--font-mono)] text-[var(--text-tertiary)] w-6">
                  #{i + 1}
                </span>
                <span className="text-sm font-medium text-[var(--text-primary)] flex-1 truncate">
                  {p.botName || p.username || 'Unknown'}
                </span>
                <span className="text-xs font-[var(--font-mono)] text-[var(--text-secondary)]">
                  {p.elo ?? '---'} ELO
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Match Results */}
      {bracketMatches.filter((m) => m.winnerId).length > 0 && (
        <Card hover={false}>
          <CardTitle className="mb-4">Completed Matches</CardTitle>
          <div className="space-y-2">
            {bracketMatches
              .filter((m) => m.winnerId)
              .map((match) => {
                const bot1Won = match.winnerId === match.bot1Id;
                return (
                  <div
                    key={match.id}
                    className="flex items-center justify-between rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'text-sm',
                        bot1Won ? 'font-bold text-[var(--accent-emerald)]' : 'text-[var(--text-secondary)]'
                      )}>
                        {match.bot1Name || 'TBD'}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">vs</span>
                      <span className={cn(
                        'text-sm',
                        !bot1Won ? 'font-bold text-[var(--accent-emerald)]' : 'text-[var(--text-secondary)]'
                      )}>
                        {match.bot2Name || 'TBD'}
                      </span>
                    </div>
                    <span className="text-sm font-[var(--font-mono)] text-[var(--text-primary)]">
                      {match.bot1Score ?? '-'} : {match.bot2Score ?? '-'}
                    </span>
                  </div>
                );
              })}
          </div>
        </Card>
      )}
    </div>
  );
}
