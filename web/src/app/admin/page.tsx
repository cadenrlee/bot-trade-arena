'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface AdminStats {
  totalUsers: number;
  totalBots: number;
  totalMatches: number;
  activeSubscriptions: number;
}

export default function AdminPage() {
  const [status, setStatus] = useState<any>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [seasonForm, setSeasonForm] = useState({
    name: '',
    number: 1,
    duration: 90,
  });
  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    format: 'SINGLE_ELIM',
    maxEntrants: 32,
  });
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [actionResults, setActionResults] = useState<Record<string, string>>({});
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  const fetchStatus = async () => {
    try {
      const data = await api.getHealth();
      setStatus(data);
    } catch {
      setStatus({ error: 'Failed to connect' });
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch {
      // Stats not available
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchStats();
  }, [fetchStats]);

  const seedAchievements = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/retention/achievements/seed`,
        { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } },
      );
      const data = await res.json();
      setSeedResult(`Seeded ${data.seeded} achievements`);
    } catch {
      setSeedResult('Failed to seed');
    }
  };

  const runAction = async (key: string, fn: () => Promise<any>) => {
    setLoadingActions((prev) => ({ ...prev, [key]: true }));
    setActionResults((prev) => ({ ...prev, [key]: '' }));
    try {
      const result = await fn();
      const msg =
        result.usersDecayed != null
          ? `Decayed ${result.usersDecayed} users`
          : result.usersWarned != null
            ? `Warned ${result.usersWarned} users`
            : result.usersGranted != null
              ? `Granted freezes to ${result.usersGranted} users`
              : result.entriesUpdated != null
                ? `Updated ${result.entriesUpdated} entries`
                : result.deleted
                  ? `Deleted ${result.deleted.matches} matches, ${result.deleted.trades} trades, ${result.deleted.snapshots} snapshots`
                  : 'Done';
      setActionResults((prev) => ({ ...prev, [key]: msg }));
    } catch (err: any) {
      setActionResults((prev) => ({ ...prev, [key]: err.message || 'Failed' }));
    }
    setLoadingActions((prev) => ({ ...prev, [key]: false }));
  };

  const createSeason = async () => {
    const now = new Date();
    const startDate = now.toISOString();
    const endDate = new Date(
      now.getTime() + seasonForm.duration * 24 * 60 * 60 * 1000,
    ).toISOString();

    setLoadingActions((prev) => ({ ...prev, season: true }));
    try {
      await api.adminCreateSeason({
        name: seasonForm.name,
        number: seasonForm.number,
        startDate,
        endDate,
      });
      setActionResults((prev) => ({
        ...prev,
        season: `Season "${seasonForm.name}" created`,
      }));
      setSeasonForm({ name: '', number: seasonForm.number + 1, duration: 90 });
    } catch (err: any) {
      setActionResults((prev) => ({
        ...prev,
        season: err.message || 'Failed to create season',
      }));
    }
    setLoadingActions((prev) => ({ ...prev, season: false }));
  };

  const createTournament = async () => {
    const now = new Date();
    const regOpen = now.toISOString();
    const regClose = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const startDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    setLoadingActions((prev) => ({ ...prev, tournament: true }));
    try {
      await api.adminCreateTournament({
        name: tournamentForm.name,
        format: tournamentForm.format,
        maxEntrants: tournamentForm.maxEntrants,
        registrationOpen: regOpen,
        registrationClose: regClose,
        startDate,
      });
      setActionResults((prev) => ({
        ...prev,
        tournament: `Tournament "${tournamentForm.name}" created`,
      }));
      setTournamentForm({ name: '', format: 'SINGLE_ELIM', maxEntrants: 32 });
    } catch (err: any) {
      setActionResults((prev) => ({
        ...prev,
        tournament: err.message || 'Failed to create tournament',
      }));
    }
    setLoadingActions((prev) => ({ ...prev, tournament: false }));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">
        Admin Panel
      </h1>

      {/* Dashboard Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-5 text-center">
            <p className="text-3xl font-bold font-[var(--font-mono)] text-[var(--accent-indigo)]">
              {stats.totalUsers}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Total Users</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-3xl font-bold font-[var(--font-mono)] text-[var(--accent-emerald)]">
              {stats.totalBots}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Total Bots</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-3xl font-bold font-[var(--font-mono)] text-[var(--accent-purple)]">
              {stats.totalMatches}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Total Matches</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-3xl font-bold font-[var(--font-mono)] text-[var(--accent-amber)]">
              {stats.activeSubscriptions}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Paid Subs</p>
          </Card>
        </div>
      )}

      {/* Server Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Server Status</h2>
          <Button size="sm" variant="secondary" onClick={fetchStatus}>
            Refresh
          </Button>
        </div>
        {status ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Status</p>
              <p className="font-[var(--font-mono)] text-[var(--accent-emerald)]">
                {status.status || 'error'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Uptime</p>
              <p className="font-[var(--font-mono)]">
                {status.uptime ? `${Math.floor(status.uptime)}s` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Connected Bots</p>
              <p className="font-[var(--font-mono)]">{status.connectedBots ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Active Matches</p>
              <p className="font-[var(--font-mono)]">{status.activeMatches ?? '-'}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">Loading server status...</p>
        )}
      </Card>

      {/* Achievement Seeder */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Achievements</h2>
        <div className="flex items-center gap-4">
          <Button onClick={seedAchievements} variant="secondary">
            Seed 50+ Achievements
          </Button>
          {seedResult && (
            <span className="text-sm text-[var(--accent-emerald)]">{seedResult}</span>
          )}
        </div>
      </Card>

      {/* Season Management */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Create Season</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Input
            label="Season Name"
            value={seasonForm.name}
            onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
            placeholder="Volatility Wars"
          />
          <Input
            label="Season Number"
            type="number"
            value={String(seasonForm.number)}
            onChange={(e) =>
              setSeasonForm({ ...seasonForm, number: parseInt(e.target.value) || 1 })
            }
          />
          <Input
            label="Duration (days)"
            type="number"
            value={String(seasonForm.duration)}
            onChange={(e) =>
              setSeasonForm({ ...seasonForm, duration: parseInt(e.target.value) || 90 })
            }
          />
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            onClick={createSeason}
            loading={loadingActions.season}
            disabled={!seasonForm.name}
          >
            Create Season
          </Button>
          {actionResults.season && (
            <span className="text-sm text-[var(--accent-emerald)]">
              {actionResults.season}
            </span>
          )}
        </div>
      </Card>

      {/* Tournament Creation */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Create Tournament</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Input
            label="Tournament Name"
            value={tournamentForm.name}
            onChange={(e) =>
              setTournamentForm({ ...tournamentForm, name: e.target.value })
            }
            placeholder="Weekly #14"
          />
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Format
            </label>
            <select
              className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none"
              value={tournamentForm.format}
              onChange={(e) =>
                setTournamentForm({ ...tournamentForm, format: e.target.value })
              }
            >
              <option value="SINGLE_ELIM">Single Elimination</option>
              <option value="DOUBLE_ELIM">Double Elimination</option>
              <option value="SWISS">Swiss</option>
              <option value="ROUND_ROBIN">Round Robin</option>
            </select>
          </div>
          <Input
            label="Max Entrants"
            type="number"
            value={String(tournamentForm.maxEntrants)}
            onChange={(e) =>
              setTournamentForm({
                ...tournamentForm,
                maxEntrants: parseInt(e.target.value) || 32,
              })
            }
          />
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            onClick={createTournament}
            loading={loadingActions.tournament}
            disabled={!tournamentForm.name}
          >
            Create Tournament
          </Button>
          {actionResults.tournament && (
            <span className="text-sm text-[var(--accent-emerald)]">
              {actionResults.tournament}
            </span>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col items-start gap-1">
            <Button
              variant="secondary"
              size="sm"
              loading={loadingActions.decay}
              onClick={() => runAction('decay', () => api.adminRunDecay())}
            >
              Run ELO Decay
            </Button>
            {actionResults.decay && (
              <span className="text-xs text-[var(--accent-emerald)]">
                {actionResults.decay}
              </span>
            )}
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button
              variant="secondary"
              size="sm"
              loading={loadingActions.streaks}
              onClick={() => runAction('streaks', () => api.adminSendStreakWarnings())}
            >
              Send Streak Warnings
            </Button>
            {actionResults.streaks && (
              <span className="text-xs text-[var(--accent-emerald)]">
                {actionResults.streaks}
              </span>
            )}
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button
              variant="secondary"
              size="sm"
              loading={loadingActions.freezes}
              onClick={() => runAction('freezes', () => api.adminGrantFreezes())}
            >
              Grant Weekly Freezes
            </Button>
            {actionResults.freezes && (
              <span className="text-xs text-[var(--accent-emerald)]">
                {actionResults.freezes}
              </span>
            )}
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button
              variant="secondary"
              size="sm"
              loading={loadingActions.leaderboards}
              onClick={() =>
                runAction('leaderboards', () => api.adminUpdateLeaderboards())
              }
            >
              Update Leaderboards
            </Button>
            {actionResults.leaderboards && (
              <span className="text-xs text-[var(--accent-emerald)]">
                {actionResults.leaderboards}
              </span>
            )}
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button
              variant="danger"
              size="sm"
              loading={loadingActions.clearTest}
              onClick={() => runAction('clearTest', () => api.adminClearTestData())}
            >
              Clear Test Data
            </Button>
            {actionResults.clearTest && (
              <span className="text-xs text-[var(--accent-emerald)]">
                {actionResults.clearTest}
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
