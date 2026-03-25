'use client';
import { cn } from '@/lib/utils';

interface ScoreBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
  className?: string;
}

export function ScoreBar({ label, value, max, color = 'var(--accent-indigo)', className }: ScoreBarProps) {
  const pct = Math.min(100, (value / max) * 100);

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="font-[var(--font-mono)] text-[var(--text-primary)]">
          {value}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
        <div
          className="h-full rounded-full score-bar"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
