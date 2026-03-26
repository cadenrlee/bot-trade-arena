'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getMatchHistory, getMatchStats, type MatchRecord } from '@/lib/matchHistory';
import { formatPnl } from '@/lib/utils';

export default function HistoryPage() {
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [stats, setStats] = useState(getMatchStats());

  useEffect(() => {
    setHistory(getMatchHistory());
    setStats(getMatchStats());
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-black font-[var(--font-display)]">Match History</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Your last {history.length} battles</p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Matches', value: stats.totalMatches, color: '' },
          { label: 'Win Rate', value: `${stats.winRate}%`, color: stats.winRate >= 50 ? 'var(--accent-emerald)' : 'var(--accent-red)' },
          { label: 'Avg P&L', value: `$${stats.avgPnl.toFixed(0)}`, color: stats.avgPnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' },
          { label: 'Events', value: `${stats.totalEventsC}/${stats.totalEventsC + stats.totalEventsM}`, color: 'var(--accent-amber)' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-center">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase">{s.label}</p>
            <p className="text-lg font-black font-[var(--font-mono)]" style={{ color: s.color || 'inherit' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Match list */}
      {history.length === 0 ? (
        <Card hover={false} className="text-center py-12">
          <p className="text-lg text-[var(--text-secondary)]">No battles yet</p>
          <Link href="/"><Button className="mt-4">⚔️ Start a Battle</Button></Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {history.map((match, i) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                match.won ? 'border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.03)]' : 'border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.03)]'
              }`}>
                {/* W/L badge */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black ${
                  match.won ? 'bg-[rgba(16,185,129,0.15)] text-[#10B981]' : 'bg-[rgba(239,68,68,0.15)] text-[#EF4444]'
                }`}>
                  {match.won ? 'W' : 'L'}
                </div>

                {/* Opponent + strategy */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">
                    vs {match.opponent}
                    {match.isMultiplayer && <span className="ml-1 text-[10px] text-[var(--accent-purple)]">REAL</span>}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    {match.strategy} · {match.myTrades}T · {match.eventsCaught} events
                  </p>
                </div>

                {/* P&L */}
                <div className="text-right">
                  <p className="text-sm font-bold font-[var(--font-mono)]" style={{ color: match.myPnl >= 0 ? '#10B981' : '#EF4444' }}>
                    {match.myPnlPct >= 0 ? '+' : ''}{match.myPnlPct.toFixed(2)}%
                  </p>
                  <p className="text-[10px] font-[var(--font-mono)]" style={{ color: match.eloChange >= 0 ? '#10B981' : '#EF4444' }}>
                    {match.eloChange >= 0 ? '+' : ''}{match.eloChange} ELO
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="text-center pt-2">
        <Link href="/"><Button>⚔️ Back to Battle</Button></Link>
      </div>
    </div>
  );
}
