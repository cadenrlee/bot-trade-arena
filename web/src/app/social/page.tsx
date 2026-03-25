'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TierBadge } from '@/components/ui/tier-badge';
import { cn } from '@/lib/utils';

const DURATIONS = [
  { label: '1 min', value: 60, desc: 'Quick bout' },
  { label: '3 min', value: 180, desc: 'Standard' },
  { label: '5 min', value: 300, desc: 'Full match' },
  { label: '10 min', value: 600, desc: 'Marathon' },
];

export default function SocialPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'friends' | 'challenges' | 'search'>('friends');
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<{ incoming: any[]; outgoing: any[] }>({ incoming: [], outgoing: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bots, setBots] = useState<any[]>([]);
  const [selectedBot, setSelectedBot] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(180);
  const [challengeTarget, setChallengeTarget] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [f, p, c, b] = await Promise.all([
        api.request<any[]>('/api/social/friends').catch(() => []),
        api.request<any[]>('/api/social/pending-requests').catch(() => []),
        api.request<any>('/api/social/challenges').catch(() => ({ incoming: [], outgoing: [] })),
        api.getBots().catch(() => []),
      ]);
      setFriends(Array.isArray(f) ? f : []);
      setPendingRequests(Array.isArray(p) ? p : []);
      setChallenges(c);
      const botList = Array.isArray(b) ? b : [];
      setBots(botList);
      if (botList.length > 0) setSelectedBot(botList[0].id);
    } catch { /* empty */ }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    try {
      const result = await api.request<any>(`/api/users/${searchQuery.trim()}`);
      setSearchResults(result ? [result] : []);
    } catch {
      setSearchResults([]);
    }
  };

  const sendFriendRequest = async (username: string) => {
    try {
      await api.request('/api/social/friend-request', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      setMessage(`Friend request sent to ${username}!`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Failed to send request');
    }
  };

  const acceptRequest = async (id: string) => {
    try {
      await api.request(`/api/social/friend-request/${id}/accept`, { method: 'POST' });
      fetchData();
    } catch { /* empty */ }
  };

  const sendChallenge = async (targetUsername: string) => {
    if (!selectedBot) { setMessage('Select a bot first'); return; }
    setSending(true);
    try {
      const result = await api.request<any>('/api/social/challenge', {
        method: 'POST',
        body: JSON.stringify({ botId: selectedBot, targetUsername }),
      });
      setMessage(`Challenge sent! Your score: ${result.yourScore}`);
      setChallengeTarget(null);
      fetchData();
    } catch (err: any) {
      setMessage(err.message || 'Failed to send challenge');
    }
    setSending(false);
  };

  const acceptChallenge = async (challengeId: string) => {
    if (!selectedBot) { setMessage('Select a bot first'); return; }
    setSending(true);
    try {
      const result = await api.request<any>(`/api/social/challenge/${challengeId}/accept`, {
        method: 'POST',
        body: JSON.stringify({ botId: selectedBot }),
      });
      if (result.youWon) {
        setMessage(`You won! ${result.defenderScore} vs ${result.challengerScore}`);
      } else if (result.winner === 'DRAW') {
        setMessage(`Draw! ${result.defenderScore} vs ${result.challengerScore}`);
      } else {
        setMessage(`You lost. ${result.defenderScore} vs ${result.challengerScore}`);
      }
      fetchData();
    } catch (err: any) {
      setMessage(err.message || 'Failed');
    }
    setSending(false);
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Sign in to access social features</h1>
        <Button onClick={() => router.push('/auth/login')}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-[var(--font-display)]">Social</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Add friends, send challenges, compare bots.</p>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] text-sm">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-xl p-1 border border-[var(--border-default)] w-fit">
        {(['friends', 'challenges', 'search'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer capitalize',
              tab === t ? 'bg-[var(--accent-indigo)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {t}
            {t === 'challenges' && challenges.incoming.length > 0 && (
              <span className="ml-2 w-5 h-5 rounded-full bg-[var(--accent-red)] text-white text-xs inline-flex items-center justify-center">
                {challenges.incoming.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bot + Duration selector (used for challenges) */}
      <Card hover={false} className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Your Bot</label>
            <select
              className="mt-1 block rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              value={selectedBot}
              onChange={(e) => setSelectedBot(e.target.value)}
            >
              {bots.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Duration</label>
            <div className="mt-1 flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setSelectedDuration(d.value)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-medium cursor-pointer border transition-all',
                    selectedDuration === d.value
                      ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]'
                      : 'border-[var(--border-default)] text-[var(--text-secondary)]',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Friends tab */}
      {tab === 'friends' && (
        <div className="space-y-4">
          {/* Pending requests */}
          {pendingRequests.length > 0 && (
            <Card hover={false}>
              <CardTitle className="mb-3">Friend Requests</CardTitle>
              <div className="space-y-2">
                {pendingRequests.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-primary)]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--accent-indigo)]/20 flex items-center justify-center text-sm font-bold text-[var(--accent-indigo)]">
                        {r.from?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm font-medium">{r.from?.username}</span>
                      <TierBadge tier={r.from?.tier} size="sm" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => acceptRequest(r.id)}>Accept</Button>
                      <Button size="sm" variant="ghost">Ignore</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Friends list */}
          {friends.length === 0 ? (
            <Card hover={false} className="text-center py-12">
              <p className="text-lg text-[var(--text-secondary)] mb-2">No friends yet</p>
              <p className="text-sm text-[var(--text-tertiary)] mb-4">Search for users to add them as friends.</p>
              <Button onClick={() => setTab('search')}>Find Friends</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {friends.map((f: any) => (
                <Card key={f.id} className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center text-white font-bold">
                    {f.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{f.displayName || f.username}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <TierBadge tier={f.tier} size="sm" />
                      <span className="text-xs font-[var(--font-mono)] text-[var(--text-secondary)]">{f.elo} ELO</span>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {f.totalMatches > 0 ? `${Math.round(f.totalWins / f.totalMatches * 100)}% WR` : 'No matches'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => router.push(`/profile/${f.username}`)}>
                      Profile
                    </Button>
                    <Button size="sm" onClick={() => setChallengeTarget(f.username)}>
                      Challenge
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Challenges tab */}
      {tab === 'challenges' && (
        <div className="space-y-4">
          {challenges.incoming.length > 0 && (
            <>
              <h2 className="text-lg font-semibold">Incoming Challenges</h2>
              {challenges.incoming.map((c: any) => (
                <Card key={c.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Challenge from opponent</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Their score: <span className="font-[var(--font-mono)] text-[var(--accent-amber)]">{c.challengerScore}</span>
                    </p>
                  </div>
                  <Button onClick={() => acceptChallenge(c.id)} loading={sending}>
                    Accept & Play
                  </Button>
                </Card>
              ))}
            </>
          )}

          {challenges.outgoing.length > 0 && (
            <>
              <h2 className="text-lg font-semibold">Your Challenges</h2>
              {challenges.outgoing.map((c: any) => (
                <Card key={c.id} hover={false} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">
                      {c.status === 'COMPLETED' ? (
                        c.winnerId === user?.id ? (
                          <span className="text-[var(--accent-emerald)]">You won!</span>
                        ) : (
                          <span className="text-[var(--accent-red)]">You lost</span>
                        )
                      ) : (
                        <span className="text-[var(--accent-amber)]">Pending...</span>
                      )}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Your score: <span className="font-[var(--font-mono)]">{c.challengerScore}</span>
                      {c.defenderScore != null && (
                        <> vs <span className="font-[var(--font-mono)]">{c.defenderScore}</span></>
                      )}
                    </p>
                  </div>
                  <span className={cn(
                    'text-xs font-medium px-3 py-1 rounded-full',
                    c.status === 'COMPLETED' ? 'bg-[var(--accent-emerald)]/10 text-[var(--accent-emerald)]' : 'bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]',
                  )}>
                    {c.status}
                  </span>
                </Card>
              ))}
            </>
          )}

          {challenges.incoming.length === 0 && challenges.outgoing.length === 0 && (
            <Card hover={false} className="text-center py-12">
              <p className="text-lg text-[var(--text-secondary)]">No challenges yet</p>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">Challenge a friend from the Friends tab!</p>
            </Card>
          )}
        </div>
      )}

      {/* Search tab */}
      {tab === 'search' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
              className="flex-1"
            />
            <Button onClick={searchUsers}>Search</Button>
          </div>

          {searchResults.map((u: any) => (
            <Card key={u.id || u.username} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center text-white font-bold">
                {u.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{u.displayName || u.username}</p>
                <div className="flex items-center gap-2">
                  <TierBadge tier={u.tier} size="sm" />
                  <span className="text-xs font-[var(--font-mono)] text-[var(--text-secondary)]">{u.elo} ELO</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => sendFriendRequest(u.username)}>
                  Add Friend
                </Button>
                <Button size="sm" onClick={() => setChallengeTarget(u.username)}>
                  Challenge
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Challenge modal */}
      {challengeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card hover={false} className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold font-[var(--font-display)] mb-2">
              Challenge {challengeTarget}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              Your bot plays a market data chunk and gets a score. {challengeTarget} plays the same data later. Highest % gain wins.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--text-tertiary)] uppercase">Your Bot</label>
                <select
                  className="mt-1 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm"
                  value={selectedBot}
                  onChange={(e) => setSelectedBot(e.target.value)}
                >
                  {bots.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-[var(--text-tertiary)] uppercase">Match Duration</label>
                <div className="mt-1 grid grid-cols-4 gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setSelectedDuration(d.value)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm font-medium cursor-pointer border transition-all text-center',
                        selectedDuration === d.value
                          ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]'
                          : 'border-[var(--border-default)] text-[var(--text-secondary)]',
                      )}
                    >
                      <div>{d.label}</div>
                      <div className="text-[10px] text-[var(--text-tertiary)]">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                className="flex-1"
                onClick={() => sendChallenge(challengeTarget)}
                loading={sending}
              >
                Send Challenge
              </Button>
              <Button variant="ghost" onClick={() => setChallengeTarget(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
