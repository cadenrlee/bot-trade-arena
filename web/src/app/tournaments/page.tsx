'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/ui/tier-badge';
import { cn } from '@/lib/utils';

function formatStartTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function TournamentCard({
  tournament,
  onRegister,
}: {
  tournament: any;
  onRegister: (id: string) => void;
}) {
  const isActive = tournament.status === 'active' || tournament.status === 'in_progress';
  const isUpcoming = tournament.status === 'upcoming' || tournament.status === 'registration';
  const isFull = tournament.maxEntrants && tournament.entrants >= tournament.maxEntrants;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <a
            href={`/tournaments/${tournament.id}`}
            className="text-base font-semibold text-[var(--text-primary)] hover:text-[var(--accent-indigo)] transition-colors"
          >
            {tournament.name}
          </a>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-[var(--text-tertiary)] font-[var(--font-mono)] uppercase">
              {tournament.format || 'Single Elimination'}
            </span>
            {tournament.tier && <TierBadge tier={tournament.tier} size="sm" />}
          </div>
        </div>
        <span
          className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full',
            isActive
              ? 'bg-[rgba(239,68,68,0.15)] text-[var(--accent-red)]'
              : isUpcoming
                ? 'bg-[rgba(99,102,241,0.15)] text-[var(--accent-indigo)]'
                : 'bg-[rgba(100,116,139,0.15)] text-[var(--text-tertiary)]'
          )}
        >
          {isActive ? 'LIVE' : isUpcoming ? 'UPCOMING' : (tournament.status || 'ENDED').toUpperCase()}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Entry Fee</p>
          <p className="text-sm font-bold font-[var(--font-mono)] text-[var(--text-primary)]">
            {tournament.entryFee ? `$${tournament.entryFee}` : 'Free'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Prize Pool</p>
          <p className="text-sm font-bold font-[var(--font-mono)] text-[var(--accent-amber)]">
            {tournament.prizePool ? `$${tournament.prizePool}` : '---'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Entrants</p>
          <p className="text-sm font-bold font-[var(--font-mono)] text-[var(--text-primary)]">
            {tournament.entrants ?? 0}{tournament.maxEntrants ? `/${tournament.maxEntrants}` : ''}
          </p>
        </div>
      </div>

      {/* Start time */}
      <p className="text-xs text-[var(--text-tertiary)]">
        {tournament.startTime
          ? (isActive ? 'Started ' : 'Starts ') + formatStartTime(tournament.startTime)
          : ''}
      </p>

      {/* Register */}
      {isUpcoming && !isFull && (
        <Button size="sm" onClick={() => onRegister(tournament.id)}>
          Register
        </Button>
      )}
      {isFull && isUpcoming && (
        <Button size="sm" variant="secondary" disabled>
          Full
        </Button>
      )}
      {isActive && (
        <Button size="sm" variant="secondary" onClick={() => window.location.href = `/tournaments/${tournament.id}`}>
          View Bracket
        </Button>
      )}
    </Card>
  );
}

export default function TournamentsPage() {
  const user = useAuthStore((s) => s.user);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bots, setBots] = useState<any[]>([]);
  const [registerModal, setRegisterModal] = useState<string | null>(null);
  const [selectedBot, setSelectedBot] = useState('');
  const [registering, setRegistering] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tourney, myBots] = await Promise.all([
        api.getTournaments(),
        user ? api.getBots() : Promise.resolve([]),
      ]);
      setTournaments(tourney || []);
      setBots(myBots || []);
    } catch { /* empty */ }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegister = async () => {
    if (!registerModal || !selectedBot) return;
    setRegistering(true);
    try {
      await api.registerTournament(registerModal, selectedBot);
      setRegisterModal(null);
      setSelectedBot('');
      fetchData();
    } catch { /* empty */ }
    setRegistering(false);
  };

  const active = tournaments.filter(
    (t) => t.status === 'active' || t.status === 'in_progress'
  );
  const upcoming = tournaments.filter(
    (t) => t.status === 'upcoming' || t.status === 'registration'
  );
  const past = tournaments.filter(
    (t) => t.status === 'completed' || t.status === 'ended'
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
          Tournaments
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Compete in organized brackets for prizes and glory.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--text-tertiary)]">Loading tournaments...</div>
      ) : (
        <>
          {/* Active Tournaments */}
          {active.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-[var(--accent-red)] mb-3 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-red)] animate-pulse" />
                Active Tournaments
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {active.map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    onRegister={setRegisterModal}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
              Upcoming Tournaments
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No upcoming tournaments.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    onRegister={setRegisterModal}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Past */}
          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-[var(--text-tertiary)] mb-3">
                Past Tournaments
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {past.map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    onRegister={setRegisterModal}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Registration Modal */}
      {registerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card hover={false} className="w-full max-w-md">
            <CardTitle className="mb-4">Select a Bot to Enter</CardTitle>
            {bots.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                You need to create a bot first before entering a tournament.
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
                    <span className="text-xs text-[var(--text-tertiary)] ml-2">ELO: {bot.elo ?? '---'}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setRegisterModal(null); setSelectedBot(''); }}>
                Cancel
              </Button>
              {bots.length > 0 && (
                <Button onClick={handleRegister} loading={registering} disabled={!selectedBot}>
                  Confirm Registration
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
