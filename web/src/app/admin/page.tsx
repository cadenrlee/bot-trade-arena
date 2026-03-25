'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function AdminPage() {
  const [status, setStatus] = useState<any>(null);
  const [seasonForm, setSeasonForm] = useState({ name: '', number: 1, duration: 90 });
  const [tournamentForm, setTournamentForm] = useState({ name: '', format: 'SINGLE_ELIM', maxEntrants: 32 });
  const [seedResult, setSeedResult] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await api.getHealth();
      setStatus(data);
    } catch { setStatus({ error: 'Failed to connect' }); }
  };

  const seedAchievements = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/retention/achievements/seed', { method: 'POST' });
      const data = await res.json();
      setSeedResult(`Seeded ${data.seeded} achievements`);
    } catch { setSeedResult('Failed to seed'); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Admin Panel</h1>

      {/* Server Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Server Status</h2>
          <Button size="sm" variant="secondary" onClick={fetchStatus}>Refresh</Button>
        </div>
        {status ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Status</p>
              <p className="font-[var(--font-mono)] text-[var(--accent-emerald)]">{status.status || 'error'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Uptime</p>
              <p className="font-[var(--font-mono)]">{status.uptime ? `${Math.floor(status.uptime)}s` : '-'}</p>
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
          <p className="text-sm text-[var(--text-tertiary)]">Click refresh to check server status</p>
        )}
      </Card>

      {/* Achievement Seeder */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Achievements</h2>
        <div className="flex items-center gap-4">
          <Button onClick={seedAchievements} variant="secondary">Seed 50+ Achievements</Button>
          {seedResult && <span className="text-sm text-[var(--accent-emerald)]">{seedResult}</span>}
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
            onChange={(e) => setSeasonForm({ ...seasonForm, number: parseInt(e.target.value) || 1 })}
          />
          <Input
            label="Duration (days)"
            type="number"
            value={String(seasonForm.duration)}
            onChange={(e) => setSeasonForm({ ...seasonForm, duration: parseInt(e.target.value) || 90 })}
          />
        </div>
        <Button variant="secondary">Create Season</Button>
      </Card>

      {/* Tournament Creation */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Create Tournament</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Input
            label="Tournament Name"
            value={tournamentForm.name}
            onChange={(e) => setTournamentForm({ ...tournamentForm, name: e.target.value })}
            placeholder="Weekly #14"
          />
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Format</label>
            <select
              className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none"
              value={tournamentForm.format}
              onChange={(e) => setTournamentForm({ ...tournamentForm, format: e.target.value })}
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
            onChange={(e) => setTournamentForm({ ...tournamentForm, maxEntrants: parseInt(e.target.value) || 32 })}
          />
        </div>
        <Button variant="secondary">Create Tournament</Button>
      </Card>

      {/* Quick Links */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm">Run ELO Decay</Button>
          <Button variant="secondary" size="sm">Send Streak Warnings</Button>
          <Button variant="secondary" size="sm">Grant Weekly Freezes</Button>
          <Button variant="secondary" size="sm">Update Leaderboards</Button>
          <Button variant="danger" size="sm">Clear Test Data</Button>
        </div>
      </Card>
    </div>
  );
}
