'use client';
import { cn, tierColor, tierGlow } from '@/lib/utils';

interface TierBadgeProps {
  tier: string | undefined | null;
  size?: 'sm' | 'md' | 'lg';
  showGlow?: boolean;
}

export function TierBadge({ tier, size = 'md', showGlow = false }: TierBadgeProps) {
  if (!tier) return null;
  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5 font-semibold',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium font-[var(--font-mono)]',
        sizes[size],
        showGlow && tierGlow(tier),
      )}
      style={{
        color: tierColor(tier),
        backgroundColor: `color-mix(in srgb, ${tierColor(tier)} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${tierColor(tier)} 30%, transparent)`,
      }}
    >
      {tier}
    </span>
  );
}
