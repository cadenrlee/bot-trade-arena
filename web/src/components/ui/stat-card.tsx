'use client';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  prefix?: string;
  className?: string;
}

export function StatCard({ label, value, color, prefix, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] p-4', className)}>
      <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{label}</p>
      <p
        className="text-2xl font-bold font-[var(--font-mono)]"
        style={{ color: color || 'var(--text-primary)' }}
      >
        {prefix}{value}
      </p>
    </div>
  );
}
