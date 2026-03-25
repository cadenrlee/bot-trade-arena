'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { ConnectedDot, InactiveDot } from '@/components/ui/live-dot';
import { cn, formatNumber, formatDuration } from '@/lib/utils';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

const CODE_EXAMPLES: Record<string, { label: string; code: string }> = {
  python: {
    label: 'Python',
    code: `import websocket
import json

API_KEY = "your-bot-api-key"
WS_URL = "${WS_URL}"

def on_message(ws, message):
    data = json.loads(message)
    if data["type"] == "tick":
        prices = data["data"]["prices"]
        # Your trading logic here
        ws.send(json.dumps({
            "type": "trade",
            "action": "buy",
            "symbol": "BTC/USD",
            "amount": 0.1
        }))

def on_open(ws):
    ws.send(json.dumps({
        "type": "auth",
        "apiKey": API_KEY
    }))

ws = websocket.WebSocketApp(
    WS_URL,
    on_message=on_message,
    on_open=on_open
)
ws.run_forever()`,
  },
  typescript: {
    label: 'TypeScript',
    code: `const API_KEY = "your-bot-api-key";
const WS_URL = "${WS_URL}";

const ws = new WebSocket(WS_URL);

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "auth",
    apiKey: API_KEY
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "tick") {
    const prices = data.data.prices;
    // Your trading logic here
    ws.send(JSON.stringify({
      type: "trade",
      action: "buy",
      symbol: "BTC/USD",
      amount: 0.1
    }));
  }
};`,
  },
  go: {
    label: 'Go',
    code: `package main

import (
    "encoding/json"
    "log"
    "github.com/gorilla/websocket"
)

const apiKey = "your-bot-api-key"
const wsURL = "${WS_URL}"

func main() {
    c, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
    if err != nil { log.Fatal(err) }
    defer c.Close()

    // Authenticate
    c.WriteJSON(map[string]string{
        "type":   "auth",
        "apiKey": apiKey,
    })

    for {
        _, message, err := c.ReadMessage()
        if err != nil { log.Fatal(err) }

        var msg map[string]interface{}
        json.Unmarshal(message, &msg)

        if msg["type"] == "tick" {
            // Your trading logic here
            c.WriteJSON(map[string]interface{}{
                "type":   "trade",
                "action": "buy",
                "symbol": "BTC/USD",
                "amount": 0.1,
            })
        }
    }
}`,
  },
};

export default function SandboxPage() {
  const user = useAuthStore((s) => s.user);
  const [bots, setBots] = useState<any[]>([]);
  const [selectedBot, setSelectedBot] = useState('');
  const [loading, setLoading] = useState(true);
  const [sandboxActive, setSandboxActive] = useState(false);
  const [connected, setConnected] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [codeTab, setCodeTab] = useState('python');
  const [logs, setLogs] = useState<string[]>([]);
  const [tick, setTick] = useState<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBots = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const data = await api.getBots();
      setBots(data || []);
      if (data?.length > 0) setSelectedBot(data[0].id);
    } catch { /* empty */ }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, []);

  const startSandbox = () => {
    setSandboxActive(true);
    setElapsed(0);
    setLogs(['[System] Sandbox session started. Waiting for bot connection...']);
    setTick(null);

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    // Simulate connection after a delay
    setTimeout(() => {
      setConnected(true);
      setLogs((prev) => [...prev, '[System] Bot connected successfully.']);

      // Simulate ticks
      let tickCount = 0;
      tickIntervalRef.current = setInterval(() => {
        tickCount++;
        const mockTick = {
          elapsed: tickCount * 5,
          prices: {
            'BTC/USD': 42000 + Math.random() * 2000 - 1000,
            'ETH/USD': 2800 + Math.random() * 200 - 100,
          },
          pnl: (Math.random() * 200 - 80).toFixed(2),
          trades: Math.floor(Math.random() * 3),
          capital: 10000 + Math.random() * 500 - 250,
        };
        setTick(mockTick);
        setLogs((prev) => [
          ...prev.slice(-50),
          `[Tick ${tickCount}] BTC: $${mockTick.prices['BTC/USD'].toFixed(2)} | ETH: $${mockTick.prices['ETH/USD'].toFixed(2)} | PnL: $${mockTick.pnl}`,
        ]);
      }, 3000);
    }, 2000);
  };

  const stopSandbox = () => {
    setSandboxActive(false);
    setConnected(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    setLogs((prev) => [...prev, '[System] Sandbox session ended.']);
  };

  const selectedBotData = bots.find((b) => b.id === selectedBot);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
          Sandbox
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Test your bot without risking ELO. Practice against simulated market conditions.
        </p>
      </div>

      {/* Instructions + Connection Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card hover={false}>
          <CardTitle className="mb-3">How It Works</CardTitle>
          <ol className="space-y-2 text-sm text-[var(--text-secondary)]">
            <li className="flex gap-2">
              <span className="font-bold text-[var(--accent-indigo)] font-[var(--font-mono)]">1.</span>
              Select one of your bots below
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-[var(--accent-indigo)] font-[var(--font-mono)]">2.</span>
              Start the sandbox session
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-[var(--accent-indigo)] font-[var(--font-mono)]">3.</span>
              Connect your bot via WebSocket using your API key
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-[var(--accent-indigo)] font-[var(--font-mono)]">4.</span>
              Trade against simulated data -- no ELO changes
            </li>
          </ol>
        </Card>

        <Card hover={false}>
          <CardTitle className="mb-3">Connection Details</CardTitle>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">WebSocket URL</label>
              <div className="mt-1 flex items-center gap-2 bg-[var(--bg-primary)] rounded-lg px-3 py-2">
                <code className="text-sm font-[var(--font-mono)] text-[var(--accent-indigo)] flex-1 truncate">
                  {WS_URL}
                </code>
                <button
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  onClick={() => navigator.clipboard.writeText(WS_URL)}
                >
                  Copy
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">API Key</label>
              <div className="mt-1 flex items-center gap-2 bg-[var(--bg-primary)] rounded-lg px-3 py-2">
                <code className="text-sm font-[var(--font-mono)] text-[var(--text-primary)] flex-1 truncate">
                  {selectedBotData?.apiKey
                    ? selectedBotData.apiKey.slice(0, 12) + '...'
                    : 'Select a bot first'}
                </code>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Bot Selection + Start */}
      <Card hover={false}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {connected ? <ConnectedDot /> : <InactiveDot />}
            <span className="text-sm text-[var(--text-secondary)]">
              {connected ? 'Connected' : sandboxActive ? 'Waiting...' : 'Disconnected'}
            </span>
          </div>

          {loading ? (
            <span className="text-sm text-[var(--text-tertiary)]">Loading bots...</span>
          ) : bots.length === 0 ? (
            <span className="text-sm text-[var(--text-tertiary)]">
              No bots found. <a href="/bots" className="text-[var(--accent-indigo)] hover:underline">Create one</a> first.
            </span>
          ) : (
            <select
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-primary)] outline-none"
              value={selectedBot}
              onChange={(e) => setSelectedBot(e.target.value)}
              disabled={sandboxActive}
            >
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name} ({bot.language})
                </option>
              ))}
            </select>
          )}

          <div className="ml-auto flex items-center gap-3">
            {sandboxActive && (
              <span className="text-sm font-[var(--font-mono)] text-[var(--text-secondary)]">
                {formatDuration(elapsed)}
              </span>
            )}
            {!sandboxActive ? (
              <Button onClick={startSandbox} disabled={!selectedBot || bots.length === 0}>
                Start Sandbox
              </Button>
            ) : (
              <Button variant="danger" onClick={stopSandbox}>
                Stop
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Live Sandbox View */}
      {sandboxActive && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Stats */}
          <div className="space-y-3">
            <StatCard
              label="PnL"
              value={tick ? `$${tick.pnl}` : '$0.00'}
              color={tick && parseFloat(tick.pnl) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'}
            />
            <StatCard
              label="Capital"
              value={tick ? `$${formatNumber(tick.capital)}` : '$10,000.00'}
            />
            <StatCard
              label="Trades"
              value={tick?.trades ?? 0}
              color="var(--accent-indigo)"
            />
          </div>

          {/* Log Feed */}
          <div className="lg:col-span-2">
            <Card hover={false} className="h-80 flex flex-col">
              <CardTitle className="mb-2">Live Feed</CardTitle>
              <div className="flex-1 overflow-y-auto bg-[var(--bg-primary)] rounded-lg p-3 font-[var(--font-mono)] text-xs leading-relaxed">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={cn(
                      'py-0.5',
                      log.includes('[System]')
                        ? 'text-[var(--accent-indigo)]'
                        : log.includes('PnL: $-')
                          ? 'text-[var(--accent-red)]'
                          : 'text-[var(--text-secondary)]'
                    )}
                  >
                    {log}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Code Examples */}
      <Card hover={false}>
        <CardTitle className="mb-4">Connection Examples</CardTitle>
        <div className="flex items-center gap-1 mb-4 bg-[var(--bg-primary)] rounded-xl p-1 border border-[var(--border-default)] w-fit">
          {Object.entries(CODE_EXAMPLES).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setCodeTab(key)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer',
                codeTab === key
                  ? 'bg-[var(--accent-indigo)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <pre className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-default)] p-4 overflow-x-auto">
            <code className="text-sm font-[var(--font-mono)] text-[var(--text-secondary)] whitespace-pre">
              {CODE_EXAMPLES[codeTab]?.code || ''}
            </code>
          </pre>
          <button
            className="absolute top-3 right-3 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] px-2 py-1 rounded cursor-pointer"
            onClick={() => navigator.clipboard.writeText(CODE_EXAMPLES[codeTab]?.code || '')}
          >
            Copy
          </button>
        </div>
      </Card>
    </div>
  );
}
