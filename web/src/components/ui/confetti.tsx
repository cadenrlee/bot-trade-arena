'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ConfettiProps {
  active: boolean;
  duration?: number;
}

const COLORS = [
  'var(--accent-indigo)',
  'var(--accent-emerald)',
  'var(--accent-purple)',
  '#f59e0b',
  '#ffffff',
];

const PIECE_COUNT = 50;

interface Piece {
  id: number;
  x: number;
  color: string;
  rotation: number;
  fallDuration: number;
  delay: number;
  size: number;
  isCircle: boolean;
}

function generatePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * 360,
    fallDuration: 1.5 + Math.random() * 2,
    delay: Math.random() * 0.6,
    size: 6 + Math.random() * 6,
    isCircle: Math.random() > 0.5,
  }));
}

export function Confetti({ active, duration = 3 }: ConfettiProps) {
  const [visible, setVisible] = useState(false);
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (active) {
      setPieces(generatePieces());
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), duration * 1000);
      return () => clearTimeout(timer);
    }
  }, [active, duration]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            '--x': `${p.x}vw`,
            '--rot': `${p.rotation}deg`,
            '--fall': `${p.fallDuration}s`,
            '--delay': `${p.delay}s`,
            '--size': `${p.size}px`,
            '--color': p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
          } as React.CSSProperties}
        />
      ))}

      <style jsx global>{`
        .confetti-piece {
          position: absolute;
          top: -10px;
          left: var(--x);
          width: var(--size);
          height: var(--size);
          background: var(--color);
          opacity: 0;
          animation: confetti-fall var(--fall) ease-in var(--delay) forwards;
        }

        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          75% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(calc(var(--rot) + 720deg));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
