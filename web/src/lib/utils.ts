import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPnl(n: number): string {
  const prefix = n >= 0 ? '+' : '';
  return `${prefix}$${formatNumber(n)}`;
}

export function formatPercent(n: number): string {
  const prefix = n >= 0 ? '+' : '';
  return `${prefix}${n.toFixed(1)}%`;
}

export function formatEloChange(n: number): string {
  const prefix = n >= 0 ? '+' : '';
  return `${prefix}${n}`;
}

export function tierColor(tier: string | undefined | null): string {
  if (!tier) return 'var(--text-secondary)';
  switch (tier.toUpperCase()) {
    case 'BRONZE': return 'var(--tier-bronze)';
    case 'SILVER': return 'var(--tier-silver)';
    case 'GOLD': return 'var(--tier-gold)';
    case 'PLATINUM': return 'var(--tier-platinum)';
    case 'DIAMOND': return 'var(--tier-diamond)';
    default: return 'var(--text-secondary)';
  }
}

export function tierGlow(tier: string | undefined | null): string {
  if (!tier) return '';
  switch (tier.toUpperCase()) {
    case 'BRONZE': return 'glow-bronze';
    case 'SILVER': return 'glow-silver';
    case 'GOLD': return 'glow-gold';
    case 'PLATINUM': return 'glow-platinum';
    case 'DIAMOND': return 'glow-diamond';
    default: return '';
  }
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
