'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PLATFORMS = [
  {
    id: 'alpaca',
    name: 'Alpaca',
    logo: 'A',
    color: '#FBCA04',
    description: 'Stocks & crypto. Free paper trading.',
    signupUrl: 'https://alpaca.markets',
    fields: [
      { key: 'brokerApiKey', label: 'API Key', placeholder: 'PK...' },
      { key: 'brokerApiSecret', label: 'Secret Key', placeholder: 'Your Alpaca secret key' },
    ],
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    logo: 'C',
    color: '#0052FF',
    description: 'Crypto only. Coming soon.',
    disabled: true,
    fields: [],
  },
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    logo: 'IB',
    color: '#D81B3C',
    description: 'Stocks, options, futures. Coming soon.',
    disabled: true,
    fields: [],
  },
];

export default function ConnectBotPage() {
  const router = useRouter();
  const [step, setStep] = useState<'pick-platform' | 'enter-keys' | 'name-bot'>('pick-platform');
  const [platform, setPlatform] = useState<typeof PLATFORMS[0] | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [botName, setBotName] = useState('');
  const [botLanguage, setBotLanguage] = useState('Python');
  const [paper, setPaper] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<any>(null);

  const selectPlatform = (p: typeof PLATFORMS[0]) => {
    if ((p as any).disabled) return;
    setPlatform(p);
    setStep('enter-keys');
  };

  const submitKeys = () => {
    for (const f of platform!.fields) {
      if (!credentials[f.key]?.trim()) {
        setError(`${f.label} is required`);
        return;
      }
    }
    setError('');
    setStep('name-bot');
  };

  const createBot = async () => {
    if (!botName.trim()) { setError('Give your bot a name'); return; }
    setLoading(true);
    setError('');
    try {
      // Create the bot
      const bot = await api.createBot({
        name: botName,
        language: botLanguage,
        description: `Connected to ${platform!.name}`,
      });

      // Attach broker credentials
      await api.updateBot(bot.id, {
        brokerPlatform: platform!.id,
        brokerApiKey: credentials.brokerApiKey,
        brokerApiSecret: credentials.brokerApiSecret,
        brokerPaper: paper,
      });

      setCreated(bot);
    } catch (err: any) {
      setError(err.message || 'Failed to create bot');
    }
    setLoading(false);
  };

  if (created) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card hover={false} className="p-8 text-center">
          <div className="text-5xl mb-4">&#9989;</div>
          <h1 className="text-2xl font-bold font-[var(--font-display)] mb-2">Bot Connected!</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            <span className="font-semibold text-[var(--text-primary)]">{created.name}</span> is linked to {platform!.name}.
          </p>

          <Card hover={false} className="text-left p-5 mb-6 bg-[var(--bg-primary)]">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Your bot&apos;s Arena API Key</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-[var(--font-mono)] text-sm text-[var(--accent-indigo)] break-all">{created.apiKey}</code>
              <button
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                onClick={() => navigator.clipboard.writeText(created.apiKey)}
              >
                Copy
              </button>
            </div>
          </Card>

          <Card hover={false} className="text-left p-5 mb-6 bg-[var(--bg-primary)]">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Run your bot locally</p>
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Start your bot on your computer. It connects to the Arena automatically:
            </p>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3 font-[var(--font-mono)] text-xs">
              <p className="text-[var(--text-tertiary)]"># If using the Arena Python connector:</p>
              <p className="text-[var(--accent-indigo)]">pip install websocket-client</p>
              <p className="text-[var(--accent-indigo)]">BTA_API_KEY={created.apiKey} python alpaca_connector.py</p>
              <p className="mt-2 text-[var(--text-tertiary)]"># Or if you have your own bot (like BOTTY):</p>
              <p className="text-[var(--accent-indigo)]">BTA_API_KEY={created.apiKey} python arena_bridge.py</p>
            </div>
          </Card>

          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push('/matches/live')}>
              Find a Match
            </Button>
            <Button variant="secondary" onClick={() => router.push('/bots')}>
              View My Bots
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-[var(--font-display)]">Connect Your Trading Bot</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Link your broker account. Run your bot on your computer. Compete in the Arena.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {['Pick Platform', 'API Keys', 'Name & Create'].map((label, i) => {
          const stepNum = i;
          const currentNum = step === 'pick-platform' ? 0 : step === 'enter-keys' ? 1 : 2;
          const isActive = stepNum === currentNum;
          const isDone = stepNum < currentNum;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-[var(--border-default)]" />}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                isActive ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' :
                isDone ? 'text-[var(--accent-emerald)]' : 'text-[var(--text-tertiary)]'
              }`}>
                <span className="font-[var(--font-mono)] text-xs">{isDone ? '✓' : i + 1}</span>
                <span>{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Pick platform */}
      {step === 'pick-platform' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLATFORMS.map((p) => (
            <Card
              key={p.id}
              className={`p-6 text-center cursor-pointer ${(p as any).disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              onClick={() => selectPlatform(p)}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-3"
                style={{ backgroundColor: p.color }}
              >
                {p.logo}
              </div>
              <h3 className="font-semibold text-lg mb-1">{p.name}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{p.description}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Step 2: Enter API keys */}
      {step === 'enter-keys' && platform && (
        <Card hover={false} className="p-6">
          <CardTitle className="mb-1">Connect to {platform.name}</CardTitle>
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            Enter your {platform.name} API keys. These stay on the server and are never shared.
            {platform.signupUrl && (
              <> Don&apos;t have an account? <a href={platform.signupUrl} target="_blank" rel="noopener" className="text-[var(--accent-indigo)] hover:underline">Sign up free</a></>
            )}
          </p>

          <div className="space-y-4">
            {platform.fields.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                placeholder={f.placeholder}
                type="password"
                value={credentials[f.key] || ''}
                onChange={(e) => setCredentials({ ...credentials, [f.key]: e.target.value })}
              />
            ))}

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="paper"
                checked={paper}
                onChange={(e) => setPaper(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="paper" className="text-sm text-[var(--text-secondary)]">
                Paper trading (recommended — no real money)
              </label>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-[var(--accent-red)]">{error}</p>}

          <div className="mt-5 flex gap-3">
            <Button onClick={submitKeys}>Next</Button>
            <Button variant="ghost" onClick={() => { setStep('pick-platform'); setError(''); }}>Back</Button>
          </div>
        </Card>
      )}

      {/* Step 3: Name bot */}
      {step === 'name-bot' && platform && (
        <Card hover={false} className="p-6">
          <CardTitle className="mb-1">Name Your Bot</CardTitle>
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            This is how your bot appears in matches and on leaderboards.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Bot Name"
              placeholder="e.g. BOTTY, AlphaTrader, etc."
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Language</label>
              <select
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none"
                value={botLanguage}
                onChange={(e) => setBotLanguage(e.target.value)}
              >
                <option value="Python">Python</option>
                <option value="TypeScript">TypeScript</option>
                <option value="Go">Go</option>
                <option value="Rust">Rust</option>
                <option value="JavaScript">JavaScript</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-[var(--accent-red)]">{error}</p>}

          <div className="mt-5 flex gap-3">
            <Button onClick={createBot} loading={loading}>Create & Connect</Button>
            <Button variant="ghost" onClick={() => { setStep('enter-keys'); setError(''); }}>Back</Button>
          </div>
        </Card>
      )}

      {/* How it works */}
      <Card hover={false} className="p-6">
        <CardTitle className="mb-3">How it works</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-2xl mb-2">1</div>
            <p className="text-sm font-semibold mb-1">Enter API keys</p>
            <p className="text-xs text-[var(--text-tertiary)]">Your broker keys let Arena pull market data. Keys stay private.</p>
          </div>
          <div>
            <div className="text-2xl mb-2">2</div>
            <p className="text-sm font-semibold mb-1">Run your bot locally</p>
            <p className="text-xs text-[var(--text-tertiary)]">Your bot runs on your computer. Your strategy stays yours.</p>
          </div>
          <div>
            <div className="text-2xl mb-2">3</div>
            <p className="text-sm font-semibold mb-1">Compete & climb</p>
            <p className="text-xs text-[var(--text-tertiary)]">Bot connects to Arena via WebSocket. Trade against others for ELO.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
