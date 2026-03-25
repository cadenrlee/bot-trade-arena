'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AchievementToastProps {
  name: string;
  description: string;
  rarity: string;
  onClose: () => void;
}

const rarityConfig: Record<string, { color: string; glow: string; label: string; shimmer?: boolean }> = {
  COMMON: { color: 'var(--text-tertiary)', glow: 'rgba(156,163,175,0.3)', label: 'Common' },
  UNCOMMON: { color: 'var(--accent-emerald)', glow: 'rgba(16,185,129,0.35)', label: 'Uncommon' },
  RARE: { color: 'var(--accent-indigo)', glow: 'rgba(99,102,241,0.4)', label: 'Rare' },
  EPIC: { color: 'var(--accent-purple)', glow: 'rgba(139,92,246,0.45)', label: 'Epic' },
  LEGENDARY: { color: '#f59e0b', glow: 'rgba(245,158,11,0.5)', label: 'Legendary', shimmer: true },
};

function getRarity(rarity: string) {
  return rarityConfig[rarity.toUpperCase()] ?? rarityConfig.COMMON;
}

export function AchievementToast({ name, description, rarity, onClose }: AchievementToastProps) {
  const config = getRarity(rarity);

  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => {
            const angle = (i / 20) * 360;
            const delay = Math.random() * 0.2;
            const size = 4 + Math.random() * 6;
            return (
              <span
                key={i}
                className="achievement-particle"
                style={{
                  '--angle': `${angle}deg`,
                  '--delay': `${delay}s`,
                  '--size': `${size}px`,
                  '--color': config.color,
                } as React.CSSProperties}
              />
            );
          })}
        </div>

        {/* Card */}
        <motion.div
          className="relative z-10 w-[340px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 text-center shadow-2xl"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            boxShadow: `0 0 60px ${config.glow}, 0 0 120px ${config.glow}`,
          }}
        >
          {/* Icon glow */}
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl"
            style={{
              background: `radial-gradient(circle, ${config.glow}, transparent 70%)`,
              boxShadow: `0 0 30px ${config.glow}`,
            }}
          >
            <span role="img" aria-label="trophy">&#127942;</span>
          </div>

          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
            Achievement Unlocked!
          </p>

          <h2
            className="mb-2 text-xl font-bold"
            style={{ color: config.color }}
          >
            {name}
          </h2>

          <p className="mb-4 text-sm text-[var(--text-secondary)]">{description}</p>

          {/* Rarity badge */}
          <span
            className={cn(
              'inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider',
              config.shimmer && 'achievement-shimmer',
            )}
            style={{
              color: config.color,
              border: `1px solid ${config.color}`,
              background: config.glow,
            }}
          >
            {config.label}
          </span>
        </motion.div>
      </motion.div>

      {/* Keyframe styles */}
      <style jsx global>{`
        .achievement-particle {
          position: absolute;
          top: 50%;
          left: 50%;
          width: var(--size);
          height: var(--size);
          border-radius: 50%;
          background: var(--color);
          animation: achievement-burst 0.8s ease-out var(--delay) forwards;
          opacity: 0;
        }

        @keyframes achievement-burst {
          0% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-180px);
            opacity: 0;
          }
        }

        .achievement-shimmer {
          background-size: 200% 100% !important;
          background-image: linear-gradient(
            110deg,
            rgba(245, 158, 11, 0.2) 0%,
            rgba(245, 158, 11, 0.5) 40%,
            rgba(255, 255, 255, 0.3) 50%,
            rgba(245, 158, 11, 0.5) 60%,
            rgba(245, 158, 11, 0.2) 100%
          ) !important;
          animation: shimmer 1.5s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </AnimatePresence>
  );
}
