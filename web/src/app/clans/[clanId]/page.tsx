'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/ui/tier-badge';
import { cn } from '@/lib/utils';

interface ClanMessage {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export default function ClanDetailPage() {
  const { clanId } = useParams<{ clanId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'chat' | 'members' | 'stats'>('chat');
  const [clan, setClan] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [clanStats, setClanStats] = useState<any>(null);
  const [messages, setMessages] = useState<ClanMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!isMember) return;
    try {
      const msgs = await api.getClanMessages(clanId);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch { /* empty */ }
  }, [clanId, isMember]);

  useEffect(() => {
    async function load() {
      try {
        const [clanData, membersData, statsData] = await Promise.all([
          api.request<any>(`/api/clans/${clanId}`),
          api.request<any[]>(`/api/clans/${clanId}/members`),
          api.request<any>(`/api/clans/${clanId}/stats`).catch(() => null),
        ]);
        setClan(clanData);
        setMembers(Array.isArray(membersData) ? membersData : []);
        setClanStats(statsData);

        // Check if current user is a member
        if (user && Array.isArray(membersData)) {
          const memberCheck = membersData.some((m: any) => m.id === user.id);
          setIsMember(memberCheck);
        }
      } catch { /* empty */ }
      setLoading(false);
    }
    load();
  }, [clanId, user]);

  // Fetch messages on mount and poll every 5s
  useEffect(() => {
    if (!isMember) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [isMember, fetchMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      await api.sendClanMessage(clanId, newMessage.trim());
      setNewMessage('');
      await fetchMessages();
    } catch { /* empty */ }
    setSending(false);
  };

  const handleLeave = async () => {
    try {
      await api.leaveClan(clanId);
      router.push('/clans');
    } catch { /* empty */ }
  };

  const handleJoin = async () => {
    try {
      await api.joinClan(clanId);
      setIsMember(true);
      // Refresh members
      const membersData = await api.request<any[]>(`/api/clans/${clanId}/members`);
      setMembers(Array.isArray(membersData) ? membersData : []);
    } catch { /* empty */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--text-tertiary)]">Loading...</p>
      </div>
    );
  }

  if (!clan) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--text-secondary)]">Clan not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Clan header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center text-white font-bold text-xl shrink-0">
          {clan.tag?.slice(0, 2)}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-[var(--font-display)]">
            {clan.name}
            <span className="ml-2 text-sm font-[var(--font-mono)] text-[var(--text-tertiary)]">[{clan.tag}]</span>
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {clan.description || 'No description'}
          </p>
          <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-tertiary)]">
            <span>{clan.memberCount} members</span>
            <span className="font-[var(--font-mono)]">{Math.round(clan.avgElo)} avg ELO</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isMember ? (
            <Button size="sm" variant="danger" onClick={handleLeave}>
              Leave Clan
            </Button>
          ) : (
            <Button size="sm" onClick={handleJoin}>
              Join Clan
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-xl p-1 border border-[var(--border-default)] w-fit">
        {(['chat', 'members', 'stats'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer capitalize',
              tab === t
                ? 'bg-[var(--accent-indigo)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Chat tab */}
      {tab === 'chat' && (
        <Card hover={false} className="p-0 overflow-hidden">
          {!isMember ? (
            <div className="p-8 text-center">
              <p className="text-[var(--text-secondary)]">Join the clan to access chat.</p>
            </div>
          ) : (
            <>
              {/* Messages area */}
              <div className="h-96 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-[var(--text-tertiary)] py-8 text-sm">
                    No messages yet. Say hello!
                  </p>
                )}
                {messages.map((msg) => {
                  const isOwn = msg.user.id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={cn('flex gap-2', isOwn && 'flex-row-reverse')}
                    >
                      <div className="w-8 h-8 rounded-full bg-[var(--accent-indigo)]/20 flex items-center justify-center text-xs font-bold text-[var(--accent-indigo)] shrink-0">
                        {msg.user.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div
                        className={cn(
                          'max-w-[70%] rounded-2xl px-4 py-2',
                          isOwn
                            ? 'bg-[var(--accent-indigo)] text-white'
                            : 'bg-[var(--bg-secondary)]',
                        )}
                      >
                        {!isOwn && (
                          <p className="text-xs font-semibold text-[var(--accent-indigo)] mb-0.5">
                            {msg.user.displayName || msg.user.username}
                          </p>
                        )}
                        <p className="text-sm break-words">{msg.content}</p>
                        <p
                          className={cn(
                            'text-[10px] mt-1',
                            isOwn ? 'text-white/60' : 'text-[var(--text-tertiary)]',
                          )}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-[var(--border-default)] p-3 flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-indigo)]"
                />
                <Button onClick={handleSend} loading={sending} disabled={!newMessage.trim()}>
                  Send
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="space-y-3">
          {members.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-[var(--text-tertiary)]">No members</p>
            </Card>
          ) : (
            members.map((m: any) => (
              <Card key={m.id || m.username} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {(m.username || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {m.displayName || m.username}
                    {m.role === 'OWNER' && (
                      <span className="ml-2 text-xs text-[var(--accent-amber)] font-[var(--font-mono)]">
                        OWNER
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <TierBadge tier={m.tier} size="sm" />
                    <span className="text-xs font-[var(--font-mono)] text-[var(--text-secondary)]">
                      {m.elo} ELO
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push(`/profile/${m.username}`)}
                >
                  Profile
                </Button>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Stats tab */}
      {tab === 'stats' && clanStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-5 text-center">
            <p className="text-2xl font-bold font-[var(--font-mono)] text-[var(--accent-indigo)]">
              {clanStats.totalMembers}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Members</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-2xl font-bold font-[var(--font-mono)] text-[var(--accent-emerald)]">
              {clanStats.avgElo}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Avg ELO</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-2xl font-bold font-[var(--font-mono)] text-[var(--accent-purple)]">
              {clanStats.totalWins}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Total Wins</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-2xl font-bold font-[var(--font-mono)] text-[var(--accent-amber)]">
              {clanStats.winRate}%
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Win Rate</p>
          </Card>
        </div>
      )}
    </div>
  );
}
