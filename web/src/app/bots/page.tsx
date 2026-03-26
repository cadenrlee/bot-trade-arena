'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConnectedDot, LiveDot, InactiveDot } from '@/components/ui/live-dot';
import { cn } from '@/lib/utils';

const LANGUAGES = ['Python', 'TypeScript', 'Go', 'Rust', 'JavaScript', 'Other'] as const;

const languageColors: Record<string, { bg: string; text: string }> = {
  Python: { bg: 'rgba(53, 114, 165, 0.2)', text: '#3572A5' },
  TypeScript: { bg: 'rgba(49, 120, 198, 0.2)', text: '#3178C6' },
  Go: { bg: 'rgba(0, 173, 216, 0.2)', text: '#00ADD8' },
  Rust: { bg: 'rgba(222, 165, 132, 0.2)', text: '#DEA584' },
  JavaScript: { bg: 'rgba(241, 224, 90, 0.2)', text: '#F1E05A' },
};

function StatusDot({ status }: { status: string }) {
  if (status === 'CONNECTED' || status === 'connected') return <ConnectedDot />;
  if (status === 'IN_MATCH' || status === 'live') return <LiveDot />;
  return <InactiveDot />;
}

function maskApiKey(key: string): string {
  if (!key) return '---';
  return key.slice(0, 8) + '...' + key.slice(-4);
}

export default function BotsPage() {
  const user = useAuthStore((s) => s.user);
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<'new' | 'existing' | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', language: 'Python', description: '' });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createError, setCreateError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchBots = useCallback(async () => {
    try {
      const data = await api.getBots();
      setBots(Array.isArray(data) ? data : []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    setCreateLoading(true);
    setCreateError('');
    try {
      const newBot = await api.createBot({
        name: formData.name,
        language: formData.language,
        description: formData.description || undefined,
      });
      setBots((prev) => [...prev, newBot]);
      setFormData({ name: '', language: 'Python', description: '' });
      setShowCreate(false);
      setCreateMode(null);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create bot. Please try again.');
    }
    setCreateLoading(false);
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      await api.deleteBot(id);
      setBots((prev) => prev.filter((b) => b.id !== id));
      setDeleteConfirm(null);
    } catch (err: any) {
      alert('Failed to delete: ' + (err?.message || 'Unknown error'));
    }
    setDeleteLoading(false);
  };

  const copyKey = (bot: any) => {
    if (bot.apiKey) {
      navigator.clipboard.writeText(bot.apiKey);
      setCopiedId(bot.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
            My Bots
            {bots.length > 0 && (
              <span className="ml-3 text-lg font-normal text-[var(--text-tertiary)]">
                ({bots.length})
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Build, connect, and deploy your trading bots.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/bots/templates">
            <Button variant="secondary">Bot Builder (No Code)</Button>
          </Link>
          <Button onClick={() => { setShowCreate(!showCreate); setCreateMode(null); }}>
            {showCreate ? 'Cancel' : '+ Add Bot'}
          </Button>
        </div>
      </div>

      {/* Create Options */}
      {showCreate && !createMode && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer text-center py-8" onClick={() => setCreateMode('new')}>
            <div className="text-3xl mb-3">&#9881;</div>
            <h3 className="font-semibold text-lg mb-1">Create New Bot</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Start fresh. Get an API key and connect your code.
            </p>
          </Card>
          <Card className="cursor-pointer text-center py-8" onClick={() => setCreateMode('existing')}>
            <div className="text-3xl mb-3">&#128268;</div>
            <h3 className="font-semibold text-lg mb-1">Connect Existing Bot</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Already have a bot? Register it here and get an API key to connect.
            </p>
          </Card>
          <Link href="/bots/templates">
            <Card className="cursor-pointer text-center py-8 h-full border-[var(--accent-purple)]/30">
              <div className="text-3xl mb-3">&#10024;</div>
              <h3 className="font-semibold text-lg mb-1 text-[var(--accent-purple)]">Use a Template</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                No code needed. Pick a strategy, tune params, deploy instantly.
              </p>
            </Card>
          </Link>
        </div>
      )}

      {/* Create / Connect Form */}
      {showCreate && createMode && (
        <Card hover={false} className="border-[var(--accent-indigo)]/30">
          <CardTitle className="mb-4">
            {createMode === 'existing' ? 'Connect Your Existing Bot' : 'Create a New Bot'}
          </CardTitle>

          {createMode === 'existing' && (
            <div className="mb-4 p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)]">
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                Register your bot to get an API key. Then connect it via WebSocket:
              </p>
              <div className="space-y-2 text-xs font-[var(--font-mono)] text-[var(--text-tertiary)]">
                <p>1. Fill in the form below and click &quot;Register Bot&quot;</p>
                <p>2. Copy the API key that appears on the bot card</p>
                <p>3. Connect your bot to: <span className="text-[var(--accent-indigo)]">ws://localhost:8080/bot-ws</span></p>
                <p>4. Authenticate: <span className="text-[var(--text-secondary)]">{`{"type": "auth", "apiKey": "YOUR_KEY"}`}</span></p>
                <p>5. Queue for match: <span className="text-[var(--text-secondary)]">{`{"type": "queue", "mode": "LIVE"}`}</span></p>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                <p className="text-xs text-[var(--text-tertiary)] mb-1">For BOTTY (Alpaca) users:</p>
                <code className="text-xs text-[var(--accent-indigo)]">cd your-bot-folder && python arena_bridge.py</code>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Bot Name"
              placeholder={createMode === 'existing' ? 'e.g. BOTTY' : 'e.g. AlphaScalper'}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Language</label>
              <select
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-indigo)]"
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <Input
              label="Description"
              placeholder="What strategy does it use?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          {createError && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 text-red-500 text-sm">
              {createError}
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleCreate} loading={createLoading}>
              {createMode === 'existing' ? 'Register Bot' : 'Create Bot'}
            </Button>
            <button
              className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              onClick={() => { setCreateMode(null); setCreateError(''); }}
            >
              Back
            </button>
          </div>
        </Card>
      )}

      {/* Bots Grid */}
      {loading ? (
        <div className="text-center py-20 text-[var(--text-tertiary)]">Loading bots...</div>
      ) : bots.length === 0 && !showCreate ? (
        <Card hover={false} className="text-center py-16">
          <p className="text-lg text-[var(--text-secondary)] mb-2">No bots yet</p>
          <p className="text-sm text-[var(--text-tertiary)] mb-6">Create a bot, connect an existing one, or use a template to get started.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => { setShowCreate(true); setCreateMode('new'); }}>
              + Create New Bot
            </Button>
            <Link href="/bots/templates">
              <Button variant="secondary">Use a Template</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {bots.map((bot) => {
            const isTemplate = bot.language?.startsWith?.('template:');
            const langKey = isTemplate ? 'Template' : bot.language;
            const lang = languageColors[langKey] || { bg: 'rgba(139,92,246,0.2)', text: '#8B5CF6' };
            const displayLang = isTemplate ? bot.language.replace('template:', '') : bot.language;

            return (
              <Card key={bot.id} className="flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot status={bot.status || 'INACTIVE'} />
                    <Link
                      href={`/bots/${bot.id}`}
                      className="text-base font-semibold text-[var(--text-primary)] hover:text-[var(--accent-indigo)] transition-colors"
                    >
                      {bot.name}
                    </Link>
                  </div>
                  <span
                    className="text-xs font-medium font-[var(--font-mono)] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: lang.bg, color: lang.text }}
                  >
                    {displayLang}
                  </span>
                </div>

                {bot.description && !isTemplate && (
                  <p className="text-xs text-[var(--text-tertiary)] line-clamp-2">{bot.description}</p>
                )}
                {isTemplate && (
                  <p className="text-xs text-[var(--accent-purple)]">Template bot — server-side execution</p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'ELO', value: bot.elo ?? '---' },
                    { label: 'Matches', value: bot.totalMatches ?? 0 },
                    { label: 'Win Rate', value: bot.totalMatches ? ((bot.totalWins / bot.totalMatches) * 100).toFixed(0) + '%' : '---', color: 'var(--accent-emerald)' },
                    { label: 'Best', value: bot.bestScore ? Math.round(bot.bestScore) : '---' },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">{s.label}</p>
                      <p className="text-sm font-bold font-[var(--font-mono)]" style={{ color: (s as any).color || 'var(--text-primary)' }}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* API Key */}
                <div className="flex items-center gap-2 bg-[var(--bg-primary)] rounded-lg px-3 py-2">
                  <span className="text-xs font-[var(--font-mono)] text-[var(--text-tertiary)] flex-1 truncate">
                    {maskApiKey(bot.apiKey || '')}
                  </span>
                  <button
                    className="text-xs text-[var(--accent-indigo)] hover:underline cursor-pointer"
                    onClick={() => copyKey(bot)}
                  >
                    {copiedId === bot.id ? 'Copied!' : 'Copy Key'}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Link href={`/bots/${bot.id}`}>
                    <Button variant="ghost" size="sm">Details</Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => copyKey(bot)}>
                    Copy Key
                  </Button>
                  {deleteConfirm === bot.id ? (
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-[var(--accent-red)]">Sure?</span>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deleteLoading}
                        onClick={() => handleDelete(bot.id)}
                      >
                        Yes, Delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-[var(--text-tertiary)] hover:text-[var(--accent-red)]"
                      onClick={() => setDeleteConfirm(bot.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
    </div>
  );
}
