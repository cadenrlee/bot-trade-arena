'use client';
import { cn } from '@/lib/utils';

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('inline-block w-2 h-2 rounded-full bg-[var(--accent-red)] live-dot', className)} />
  );
}

export function ConnectedDot({ className }: { className?: string }) {
  return (
    <span className={cn('inline-block w-2 h-2 rounded-full bg-[var(--accent-emerald)] connected-dot', className)} />
  );
}

export function InactiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('inline-block w-2 h-2 rounded-full bg-[var(--text-tertiary)]', className)} />
  );
}
