'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

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
      setSentRequests((prev) => new Set(prev).add(username));
      setMessage(`Friend request sent to ${username}!`);
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      setMessage(err.message || 'Failed to send request');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const acceptRequest = async (id: string) => {
    setAcceptingId(id);
    try {
      await api.request(`/api/social/friend-request/${id}/accept`, { method: 'POST' });
      setMessage('Friend request accepted!');
      setTimeout(() => setMessage(''), 5000);
      fetchData();
    } catch { /* empty */ }
    setAcceptingId(null);
  };

  const rejectRequest = async (id: string) => {
    setRejectingId(id);
    // Optimistic update: remove from list immediately
    setPendingRequests((prev) => prev.filter((r: any) => r.id !== id));
    try {
      await api.request(`/api/social/friend-request/${id}/reject`, { method: 'POST' });
    } catch { /* empty */ }
    setRejectingId(null);
  };

  // Challenge replay state
  const [replayData, setReplayData] = useState<any>(null);
  const [replayIdx, setReplayIdx] = useState(0);
  const [replayBot, setReplayBot] = useState('');
  const [replayTarget, setReplayTarget] = useState('');

  const sendChallenge = async (targetUsername: string) => {
    if (!selectedBot) { setMessage('Select a bot first'); return; }
    setSending(true);
    setMessage('');
    try {
      const result = await api.request<any>('/api/social/challenge', {
        method: 'POST',
        body: JSON.stringify({ botId: selectedBot, targetUsername, duration: selectedDuration }),
      });
      setChallengeTarget(null);

      if (result.replay && result.replay.length > 0) {
        // Show the battle replay!
        const myBot = bots.find((b: any) => b.id === selectedBot);
        setReplayBot(myBot?.name || 'Your Bot');
        setReplayTarget(targetUsername);
        setReplayData(result);
        setReplayIdx(0);
      } else {
        setMessage(`Challenge sent! Your score: ${result.yourScore}`);
      }
      fetchData();
    } catch (err: any) {
      setMessage(err.message || 'Failed to send challenge');
    }
    setSending(false);
  };

  // Animate replay
  useEffect(() => {
    if (!replayData?.replay || replayIdx >= replayData.replay.length) return;
    const timer = setTimeout(() => setReplayIdx(i => i + 1), 100); // 10x speed
    return () => clearTimeout(timer);
  }, [replayIdx, replayData]);

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

      {/* ===== CHALLENGE REPLAY BATTLE ===== */}
      {replayData && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card hover={false} className="p-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04]" style={{
              background: 'radial-gradient(ellipse at 25% 50%, var(--accent-indigo), transparent 50%), radial-gradient(ellipse at 75% 50%, var(--accent-emerald), transparent 50%)',
            }} />

            {(() => {
              const frame = replayData.replay[Math.min(replayIdx, replayData.replay.length - 1)];
              const done = replayIdx >= replayData.replay.length;
              const pnl = frame?.bot1Pnl || 0;
              const pnlPct = (pnl / 100000) * 100;
              const trades = frame?.bot1Trades || 0;
              const score = replayData.score?.compositeScore || 0;
              const duration = replayData.replay.length;
              const progress = Math.min(100, (replayIdx / duration) * 100);

              return (
                <div className="relative space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold font-[var(--font-display)]">
                        Challenge vs {replayTarget}
                      </h3>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {done ? 'Challenge sent! Waiting for response...' : 'Your bot is trading...'}
                      </p>
                    </div>
                    {done && (
                      <Button size="sm" variant="secondary" onClick={() => setReplayData(null)}>Close</Button>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple)]" style={{ width: `${progress}%` }} />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-[var(--text-tertiary)]">P&L</p>
                      <p className="text-2xl font-black font-[var(--font-mono)]" style={{ color: pnl >= 0 ? '#10B981' : '#EF4444' }}>
                        {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-tertiary)]">Trades</p>
                      <p className="text-2xl font-black font-[var(--font-mono)]">{trades}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-tertiary)]">{done ? 'Final Score' : 'Score'}</p>
                      <p className="text-2xl font-black font-[var(--font-mono)] text-[var(--accent-indigo)]">
                        {done ? Math.round(score) : '...'}
                      </p>
                    </div>
                  </div>

                  {/* Bot name */}
                  <p className="text-center text-sm">
                    <span className="font-bold text-[var(--accent-indigo)]">{replayBot}</span>
                    {' scored '}
                    <span className="font-bold font-[var(--font-mono)]">{Math.round(score)}</span>
                    {` — now ${replayTarget} needs to beat it!`}
                  </p>
                </div>
              );
            })()}
          </Card>
        </motion.div>
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
                      <Button size="sm" onClick={() => acceptRequest(r.id)} loading={acceptingId === r.id}>
                        {acceptingId === r.id ? 'Accepting...' : 'Accept'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => rejectRequest(r.id)}>
                        Ignore
                      </Button>
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
                    {(f.username || '?')[0].toUpperCase()}
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
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center text-white font-bold text-sm">
                      {c.challenger?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-semibold">{c.challenger?.username || 'Someone'} challenged you!</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Their score: <span className="font-[var(--font-mono)] text-[var(--accent-amber)] font-bold">{Math.round(c.challengerScore)}</span>
                        <span className="text-[var(--text-tertiary)] ml-2">Can you beat it?</span>
                      </p>
                    </div>
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
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm',
                      c.status === 'COMPLETED' && c.winnerId === user?.id ? 'bg-[var(--accent-emerald)]' :
                      c.status === 'COMPLETED' ? 'bg-[var(--accent-red)]' : 'bg-[var(--bg-tertiary)]'
                    )}>
                      {c.status === 'COMPLETED' ? (c.winnerId === user?.id ? 'W' : 'L') : '?'}
                    </div>
                    <div>
                      <p className="font-semibold">
                        vs {c.target?.username || 'Unknown'}
                        {c.status === 'COMPLETED' && (
                          c.winnerId === user?.id
                            ? <span className="text-[var(--accent-emerald)] ml-2">You won!</span>
                            : c.winnerId ? <span className="text-[var(--accent-red)] ml-2">You lost</span>
                            : <span className="text-[var(--text-tertiary)] ml-2">Draw</span>
                        )}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        You: <span className="font-[var(--font-mono)] font-bold">{Math.round(c.challengerScore)}</span>
                        {c.defenderScore != null && (
                          <> — Them: <span className="font-[var(--font-mono)] font-bold">{Math.round(c.defenderScore)}</span></>
                        )}
                        {c.status === 'PENDING' && <span className="text-[var(--accent-amber)] ml-2">Waiting for response...</span>}
                      </p>
                    </div>
                  </div>
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
                {friends.some((f: any) => f.username === u.username) ? (
                  <Button size="sm" variant="secondary" disabled>
                    Friends
                  </Button>
                ) : sentRequests.has(u.username) ? (
                  <Button size="sm" variant="secondary" disabled className="opacity-60">
                    Request Sent
                  </Button>
                ) : u.username === user?.username ? null : (
                  <Button size="sm" variant="secondary" onClick={() => sendFriendRequest(u.username)}>
                    Add Friend
                  </Button>
                )}
                {u.username !== user?.username && (
                  <Button size="sm" onClick={() => setChallengeTarget(u.username)}>
                    Challenge
                  </Button>
                )}
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
