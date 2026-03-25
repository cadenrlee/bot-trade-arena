'use client';

import { cn } from '@/lib/utils';

interface HealthBarProps {
  bot1Name: string;
  bot2Name: string;
  bot1Score: number;
  bot2Score: number;
}

export function HealthBar({ bot1Name, bot2Name, bot1Score, bot2Score }: HealthBarProps) {
  const total = bot1Score + bot2Score;
  const bot1Pct = total > 0 ? (bot1Score / total) * 100 : 50;
  const bot2Pct = total > 0 ? (bot2Score / total) * 100 : 50;
  const bot1Winning = bot1Score > bot2Score;
  const bot2Winning = bot2Score > bot1Score;

  return (
    <div className="w-full space-y-2">
      {/* Names and scores */}
      <div className="flex items-center justify-between text-sm">
        <span
          className={cn(
            'font-semibold',
            bot1Winning ? 'text-[var(--accent-indigo)]' : 'text-[var(--text-secondary)]',
          )}
        >
          {bot1Name}
        </span>

        <div className="flex items-center gap-2 font-[var(--font-mono)] text-xs">
          <span
            className="font-bold"
            style={{ color: 'var(--accent-indigo)' }}
          >
            {bot1Score.toLocaleString()}
          </span>
          <span className="text-[var(--text-tertiary)]">vs</span>
          <span
            className="font-bold"
            style={{ color: 'var(--accent-emerald)' }}
          >
            {bot2Score.toLocaleString()}
          </span>
        </div>

        <span
          className={cn(
            'font-semibold',
            bot2Winning ? 'text-[var(--accent-emerald)]' : 'text-[var(--text-secondary)]',
          )}
        >
          {bot2Name}
        </span>
      </div>

      {/* Bar */}
      <div className="relative flex h-4 w-full overflow-hidden rounded-full bg-[var(--bg-primary)]">
        {/* Bot 1 side (left, indigo) */}
        <div
          className="relative h-full transition-all duration-500 ease-in-out"
          style={{
            width: `${bot1Pct}%`,
            background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-indigo))',
            boxShadow: bot1Winning ? '0 0 12px var(--accent-indigo), 0 0 24px rgba(99,102,241,0.3)' : 'none',
          }}
        >
          {bot1Winning && (
            <div className="absolute inset-0 animate-pulse rounded-l-full bg-white/10" />
          )}
        </div>

        {/* Bot 2 side (right, emerald) */}
        <div
          className="relative h-full transition-all duration-500 ease-in-out"
          style={{
            width: `${bot2Pct}%`,
            background: 'linear-gradient(90deg, var(--accent-emerald), var(--accent-emerald))',
            boxShadow: bot2Winning ? '0 0 12px var(--accent-emerald), 0 0 24px rgba(16,185,129,0.3)' : 'none',
          }}
        >
          {bot2Winning && (
            <div className="absolute inset-0 animate-pulse rounded-r-full bg-white/10" />
          )}
        </div>

        {/* Center divider */}
        <div
          className="absolute top-0 h-full w-0.5 bg-[var(--bg-surface,var(--bg-secondary))] transition-all duration-500 ease-in-out"
          style={{ left: `${bot1Pct}%`, transform: 'translateX(-50%)' }}
        />
      </div>
    </div>
  );
}
