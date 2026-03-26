'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ClansPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [clans, setClans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', tag: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getClans();
        setClans(Array.isArray(data) ? data : []);
      } catch { /* empty */ }
      setLoading(false);
    }
    load();
  }, []);

  const handleCreate = async () => {
    if (!createForm.name || !createForm.tag) return;
    setCreating(true);
    try {
      const clan = await api.createClan({
        name: createForm.name,
        tag: createForm.tag,
        description: createForm.description || undefined,
      });
      setMessage(`Clan "${clan.name}" created!`);
      setShowCreate(false);
      setCreateForm({ name: '', tag: '', description: '' });
      // Refresh list
      const data = await api.getClans();
      setClans(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setMessage(err.message || 'Failed to create clan');
    }
    setCreating(false);
    setTimeout(() => setMessage(''), 4000);
  };

  const handleJoin = async (clanId: string) => {
    try {
      await api.joinClan(clanId);
      setMessage('Joined clan!');
      router.push(`/clans/${clanId}`);
    } catch (err: any) {
      setMessage(err.message || 'Failed to join');
    }
    setTimeout(() => setMessage(''), 4000);
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Sign in to view clans</h1>
        <Button onClick={() => router.push('/auth/login')}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-[var(--font-display)]">Clans</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Join a clan to team up, chat, and compete together.
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create Clan'}
        </Button>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] text-sm">
          {message}
        </div>
      )}

      {showCreate && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Create a New Clan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Input
              label="Clan Name"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="Alpha Traders"
            />
            <Input
              label="Tag (2-6 chars)"
              value={createForm.tag}
              onChange={(e) => setCreateForm({ ...createForm, tag: e.target.value.toUpperCase() })}
              placeholder="ALPHA"
            />
            <Input
              label="Description"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="Top trading clan"
            />
          </div>
          <Button onClick={handleCreate} loading={creating} disabled={!createForm.name || !createForm.tag}>
            Create Clan
          </Button>
        </Card>
      )}

      {loading ? (
        <p className="text-center text-[var(--text-tertiary)] py-12">Loading clans...</p>
      ) : clans.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-lg text-[var(--text-secondary)] mb-2">No clans yet</p>
          <p className="text-sm text-[var(--text-tertiary)]">Be the first to create one!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clans.map((clan: any) => (
            <Card key={clan.id} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center text-white font-bold text-sm shrink-0">
                {clan.tag?.slice(0, 2) || '??'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {clan.name}
                  <span className="ml-2 text-xs font-[var(--font-mono)] text-[var(--text-tertiary)]">[{clan.tag}]</span>
                </p>
                <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mt-0.5">
                  <span>{clan.memberCount} members</span>
                  <span className="font-[var(--font-mono)]">{Math.round(clan.avgElo)} avg ELO</span>
                  <span>{clan.totalWins}W / {clan.totalMatches}M</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => router.push(`/clans/${clan.id}`)}>
                  View
                </Button>
                <Button size="sm" onClick={() => handleJoin(clan.id)}>
                  Join
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
