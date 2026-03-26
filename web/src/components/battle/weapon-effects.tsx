'use client';

import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WeaponEffectProps {
  effect: string;
  color: string;
  side: 'left' | 'right';
  active: boolean;
}

interface CritEffectProps {
  effect: string;
  color: string;
  active: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function polarToXY(angle: number, distance: number) {
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  };
}

const FIRE_COLORS = ['#EF4444', '#F97316', '#FBBF24', '#EF4444', '#F59E0B', '#FCD34D'];
const ICE_COLORS = ['#67E8F9', '#22D3EE', '#A5F3FC', '#06B6D4', '#CFFAFE'];

// ─── Sparks Effect (Fist) ────────────────────────────────────────────────────

function SparksEffect({ color, side }: { color: string; side: 'left' | 'right' }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2 + randomBetween(-0.3, 0.3);
        const dist = randomBetween(30, 70);
        const { x, y } = polarToXY(angle, dist);
        return { id: i, x, y, size: randomBetween(3, 7), delay: randomBetween(0, 0.05) };
      }),
    [],
  );

  const originX = side === 'left' ? '70%' : '30%';

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ perspective: 400 }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: originX,
            top: '50%',
            backgroundColor: color,
            boxShadow: `0 0 ${p.size * 2}px ${color}, 0 0 ${p.size * 4}px ${color}40`,
          }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ x: p.x, y: p.y, scale: 0, opacity: 0 }}
          transition={{ duration: 0.6, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ─── Slash Effect ────────────────────────────────────────────────────────────

function SlashEffect({ color, side }: { color: string; side: 'left' | 'right' }) {
  const flip = side === 'right';

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 300 200"
        style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      >
        <defs>
          <filter id="slash-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Trail */}
        <motion.path
          d="M 60 140 Q 150 20, 240 80"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          filter="url(#slash-glow)"
          opacity={0.3}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.3, 0] }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
        {/* Main slash */}
        <motion.path
          d="M 60 140 Q 150 20, 240 80"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          filter="url(#slash-glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 1], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        {/* Bright tip */}
        <motion.circle
          r="4"
          fill="white"
          filter="url(#slash-glow)"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 1, 0],
            cx: [60, 150, 240],
            cy: [140, 60, 80],
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </svg>
    </div>
  );
}

// ─── Beam Effect ─────────────────────────────────────────────────────────────

function BeamEffect({ color, side }: { color: string; side: 'left' | 'right' }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Core beam */}
      <motion.div
        className="absolute"
        style={{
          top: '48%',
          left: side === 'left' ? '15%' : '15%',
          right: side === 'left' ? '15%' : '15%',
          height: 6,
          background: `linear-gradient(${side === 'left' ? '90deg' : '270deg'}, ${color}, white, ${color})`,
          borderRadius: 4,
          boxShadow: `0 0 20px ${color}, 0 0 40px ${color}, 0 0 60px ${color}80`,
        }}
        initial={{
          scaleX: 0,
          opacity: 0,
          originX: side === 'left' ? 0 : 1,
        }}
        animate={{
          scaleX: [0, 1, 1, 1],
          opacity: [0, 1, 1, 0],
        }}
        transition={{ duration: 0.7, ease: 'easeOut', times: [0, 0.3, 0.6, 1] }}
      />
      {/* Outer glow */}
      <motion.div
        className="absolute"
        style={{
          top: '44%',
          left: side === 'left' ? '15%' : '15%',
          right: side === 'left' ? '15%' : '15%',
          height: 20,
          background: `linear-gradient(${side === 'left' ? '90deg' : '270deg'}, transparent, ${color}40, transparent)`,
          borderRadius: 10,
        }}
        initial={{
          scaleX: 0,
          opacity: 0,
          originX: side === 'left' ? 0 : 1,
        }}
        animate={{
          scaleX: [0, 1, 1, 1],
          opacity: [0, 0.8, 0.6, 0],
        }}
        transition={{ duration: 0.7, ease: 'easeOut', times: [0, 0.3, 0.6, 1] }}
      />
      {/* Impact flash */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 30,
          height: 30,
          top: '42%',
          ...(side === 'left' ? { right: '14%' } : { left: '14%' }),
          background: `radial-gradient(circle, white, ${color}, transparent)`,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
      />
    </div>
  );
}

// ─── Explosion Effect ────────────────────────────────────────────────────────

function ExplosionEffect({ color, side }: { color: string; side: 'left' | 'right' }) {
  const debris = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * Math.PI * 2 + randomBetween(-0.2, 0.2);
        const dist = randomBetween(40, 100);
        const { x, y } = polarToXY(angle, dist);
        return {
          id: i,
          x,
          y,
          size: randomBetween(2, 6),
          delay: randomBetween(0, 0.1),
          rotation: randomBetween(0, 360),
        };
      }),
    [],
  );

  const originX = side === 'left' ? '70%' : '30%';

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Main expanding circle */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 20,
          height: 20,
          left: originX,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          border: `3px solid ${color}`,
          boxShadow: `0 0 30px ${color}, inset 0 0 20px ${color}60`,
        }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: [0, 6, 8], opacity: [1, 0.7, 0] }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      {/* Inner flash */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 40,
          height: 40,
          left: originX,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, white, ${color}, transparent)`,
        }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: [0, 2, 3], opacity: [1, 0.5, 0] }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      {/* Debris particles */}
      {debris.map((d) => (
        <motion.div
          key={d.id}
          className="absolute"
          style={{
            width: d.size,
            height: d.size,
            left: originX,
            top: '50%',
            backgroundColor: color,
            borderRadius: d.size > 4 ? 1 : '50%',
            boxShadow: `0 0 ${d.size * 2}px ${color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: d.x, y: d.y, opacity: 0, rotate: d.rotation }}
          transition={{ duration: 0.7, delay: d.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ─── Lightning Effect ────────────────────────────────────────────────────────

function LightningEffect({ color, side }: { color: string; side: 'left' | 'right' }) {
  const bolts = useMemo(() => {
    return Array.from({ length: 3 }, (_, boltIdx) => {
      const startX = side === 'left' ? 40 : 260;
      const endX = side === 'left' ? 260 : 40;
      const segments = 8;
      const points: string[] = [];

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = startX + (endX - startX) * t;
        const y = 100 + (i === 0 || i === segments ? 0 : randomBetween(-40, 40));
        points.push(`${x},${y}`);
      }

      return { id: boltIdx, points: points.join(' '), delay: boltIdx * 0.12 };
    });
  }, [side]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 200">
        <defs>
          <filter id="lightning-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {bolts.map((bolt) => (
          <g key={bolt.id}>
            {/* Wide glow */}
            <motion.polyline
              points={bolt.points}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinejoin="round"
              filter="url(#lightning-glow)"
              opacity={0.3}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.4, 0, 0.3, 0, 0.2, 0] }}
              transition={{ duration: 0.7, delay: bolt.delay, ease: 'linear' }}
            />
            {/* Core bolt */}
            <motion.polyline
              points={bolt.points}
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinejoin="round"
              filter="url(#lightning-glow)"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0, 0.9, 0, 0.7, 0] }}
              transition={{ duration: 0.7, delay: bolt.delay, ease: 'linear' }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Fire Effect ─────────────────────────────────────────────────────────────

function FireEffect({ color, side }: { color: string; side: 'left' | 'right' }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => ({
        id: i,
        x: randomBetween(-30, 30),
        size: randomBetween(6, 14),
        color: FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)],
        delay: randomBetween(0, 0.15),
        duration: randomBetween(0.5, 0.8),
        drift: randomBetween(-15, 15),
      })),
    [],
  );

  const originX = side === 'left' ? '70%' : '30%';

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Base glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 60,
          height: 60,
          left: originX,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${color}80, ${color}20, transparent)`,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 2, 1.5, 2, 1.8], opacity: [0, 0.8, 0.5, 0.7, 0] }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      {/* Fire particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size * 1.3,
            left: originX,
            top: '50%',
            backgroundColor: p.color,
            borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            boxShadow: `0 0 ${p.size}px ${p.color}, 0 0 ${p.size * 2}px ${p.color}60`,
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
          animate={{
            x: [0, p.x + p.drift],
            y: [0, randomBetween(-50, -90)],
            opacity: [0, 1, 1, 0],
            scale: [0, 1.2, 0.8, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Ice Effect ──────────────────────────────────────────────────────────────

function IceEffect({ color, side }: { color: string; side: 'left' | 'right' }) {
  const crystals = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const dist = randomBetween(30, 80);
        const { x, y } = polarToXY(angle, dist);
        return {
          id: i,
          x,
          y,
          size: randomBetween(6, 12),
          rotation: randomBetween(0, 360),
          spinSpeed: randomBetween(-180, 180),
          delay: randomBetween(0, 0.1),
          color: ICE_COLORS[Math.floor(Math.random() * ICE_COLORS.length)],
        };
      }),
    [],
  );

  const originX = side === 'left' ? '70%' : '30%';

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Frost flash */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 50,
          height: 50,
          left: originX,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, white, ${color}60, transparent)`,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 2.5], opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      {/* Ice crystals (diamond shapes) */}
      {crystals.map((c) => (
        <motion.div
          key={c.id}
          className="absolute"
          style={{
            width: c.size,
            height: c.size,
            left: originX,
            top: '50%',
            backgroundColor: c.color,
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            boxShadow: `0 0 ${c.size}px ${c.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0, rotate: c.rotation }}
          animate={{
            x: c.x,
            y: c.y,
            opacity: [0, 1, 1, 0],
            scale: [0, 1.2, 1, 0.5],
            rotate: c.rotation + c.spinSpeed,
          }}
          transition={{ duration: 0.7, delay: c.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ─── Vortex Effect ───────────────────────────────────────────────────────────

function VortexEffect({ color, side }: { color: string; side: 'left' | 'right' }) {
  const suckParticles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const startDist = randomBetween(60, 100);
        const { x: startX, y: startY } = polarToXY(angle, startDist);
        return {
          id: i,
          startX,
          startY,
          size: randomBetween(2, 5),
          delay: randomBetween(0, 0.3),
        };
      }),
    [],
  );

  const originX = side === 'left' ? '70%' : '30%';

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 300 200"
      >
        <defs>
          <filter id="vortex-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Spinning spiral */}
        <motion.path
          d={`M ${side === 'left' ? 210 : 90} 100
              Q ${side === 'left' ? 210 : 90} 70, ${side === 'left' ? 230 : 70} 70
              Q ${side === 'left' ? 250 : 50} 70, ${side === 'left' ? 250 : 50} 100
              Q ${side === 'left' ? 250 : 50} 130, ${side === 'left' ? 220 : 80} 130
              Q ${side === 'left' ? 190 : 110} 130, ${side === 'left' ? 190 : 110} 100
              Q ${side === 'left' ? 190 : 110} 60, ${side === 'left' ? 240 : 60} 60`}
          fill="none"
          stroke={color}
          strokeWidth="3"
          filter="url(#vortex-glow)"
          initial={{ pathLength: 0, opacity: 0, rotate: 0 }}
          animate={{
            pathLength: [0, 1],
            opacity: [0, 1, 0.8, 0],
            rotate: [0, 360],
          }}
          style={{
            transformOrigin: `${side === 'left' ? '70%' : '30%'} 50%`,
          }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        />
        {/* Wide glow ring */}
        <motion.circle
          cx={side === 'left' ? 210 : 90}
          cy={100}
          fill="none"
          stroke={color}
          strokeWidth="2"
          filter="url(#vortex-glow)"
          opacity={0.4}
          initial={{ r: 5, opacity: 0 }}
          animate={{ r: [5, 50], opacity: [0, 0.5, 0] }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      {/* Particles getting sucked in */}
      {suckParticles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: originX,
            top: '50%',
            backgroundColor: color,
            boxShadow: `0 0 ${p.size * 3}px ${color}`,
          }}
          initial={{ x: p.startX, y: p.startY, opacity: 0, scale: 1 }}
          animate={{ x: 0, y: 0, opacity: [0, 1, 1, 0], scale: [1, 0.5, 0] }}
          transition={{ duration: 0.7, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

// ─── Main WeaponEffect Component ─────────────────────────────────────────────

export function WeaponEffect({ effect, color, side, active }: WeaponEffectProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={`${effect}-${Date.now()}`}
          className="absolute inset-0 pointer-events-none z-20"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          {effect === 'sparks' && <SparksEffect color={color} side={side} />}
          {effect === 'slash' && <SlashEffect color={color} side={side} />}
          {effect === 'beam' && <BeamEffect color={color} side={side} />}
          {effect === 'explosion' && <ExplosionEffect color={color} side={side} />}
          {effect === 'lightning' && <LightningEffect color={color} side={side} />}
          {effect === 'fire' && <FireEffect color={color} side={side} />}
          {effect === 'ice' && <IceEffect color={color} side={side} />}
          {effect === 'vortex' && <VortexEffect color={color} side={side} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CRITICAL HIT EFFECTS
// ═════════════════════════════════════════════════════════════════════════════

// ─── Shockwave ───────────────────────────────────────────────────────────────

function ShockwaveEffect({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {[0, 0.1, 0.2].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 30,
            height: 30,
            border: `${3 - i}px solid ${color}`,
            boxShadow: `0 0 20px ${color}60`,
          }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: [0, 8, 12], opacity: [1, 0.6, 0] }}
          transition={{ duration: 0.8, delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ─── Double Slash ────────────────────────────────────────────────────────────

function DoubleSlashEffect({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 200">
        <defs>
          <filter id="dslash-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* First slash (top-left to bottom-right) */}
        <motion.path
          d="M 50 30 L 250 170"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          filter="url(#dslash-glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 1], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        {/* Second slash (top-right to bottom-left) */}
        <motion.path
          d="M 250 30 L 50 170"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          filter="url(#dslash-glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 1], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        />
        {/* Center impact flash */}
        <motion.circle
          cx="150"
          cy="100"
          fill="white"
          filter="url(#dslash-glow)"
          initial={{ r: 0, opacity: 0 }}
          animate={{ r: [0, 15, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 0.4, delay: 0.25 }}
        />
      </svg>
    </div>
  );
}

// ─── Earthquake ──────────────────────────────────────────────────────────────

function EarthquakeEffect({ color }: { color: string }) {
  const lines = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        y: 30 + i * 20,
        delay: i * 0.03,
        width: randomBetween(60, 100),
      })),
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {lines.map((line) => (
        <motion.div
          key={line.id}
          className="absolute left-0 right-0"
          style={{
            top: `${line.y}px`,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            boxShadow: `0 0 10px ${color}40`,
          }}
          initial={{ scaleX: 0, opacity: 0, x: 0 }}
          animate={{
            scaleX: [0, 1, 1, 0],
            opacity: [0, 0.8, 0.6, 0],
            x: [0, -8, 8, -4, 4, 0],
          }}
          transition={{ duration: 0.7, delay: line.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ─── Overcharge ──────────────────────────────────────────────────────────────

function OverchargeEffect({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      {/* Pulsing beam */}
      <motion.div
        className="absolute"
        style={{
          width: '100%',
          height: 10,
          background: `linear-gradient(90deg, transparent, ${color}, white, ${color}, transparent)`,
          boxShadow: `0 0 40px ${color}, 0 0 80px ${color}60`,
        }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{
          scaleY: [0, 3, 1, 4, 1, 2, 0],
          opacity: [0, 1, 0.7, 1, 0.8, 0.5, 0],
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      {/* Expanding rings */}
      {[0, 0.15, 0.3].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            width: 20,
            height: 20,
            border: `2px solid ${color}`,
            borderRadius: '50%',
            boxShadow: `0 0 15px ${color}`,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 5, 8], opacity: [0, 0.5, 0] }}
          transition={{ duration: 0.6, delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ─── Thunderstorm ────────────────────────────────────────────────────────────

function ThunderstormEffect({ color }: { color: string }) {
  const bolts = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const startX = 40 + i * 55;
        const segments = 6;
        const points: string[] = [];
        for (let j = 0; j <= segments; j++) {
          const t = j / segments;
          const x = startX + randomBetween(-20, 20);
          const y = t * 200;
          points.push(`${x},${y}`);
        }
        return { id: i, points: points.join(' '), delay: randomBetween(0, 0.3) };
      }),
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Flash */}
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: color }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.15, 0, 0.1, 0] }}
        transition={{ duration: 0.6 }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 200">
        <defs>
          <filter id="storm-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {bolts.map((bolt) => (
          <g key={bolt.id}>
            <motion.polyline
              points={bolt.points}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinejoin="round"
              filter="url(#storm-glow)"
              opacity={0.3}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.4, 0, 0.3, 0] }}
              transition={{ duration: 0.6, delay: bolt.delay }}
            />
            <motion.polyline
              points={bolt.points}
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinejoin="round"
              filter="url(#storm-glow)"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0, 0.8, 0] }}
              transition={{ duration: 0.6, delay: bolt.delay }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Firestorm ───────────────────────────────────────────────────────────────

function FirestormEffect({ color }: { color: string }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: randomBetween(-120, 120),
        y: randomBetween(-80, -160),
        size: randomBetween(4, 12),
        color: FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)],
        delay: randomBetween(0, 0.2),
        duration: randomBetween(0.5, 0.8),
      })),
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {/* Massive fire base glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 100,
          height: 100,
          background: `radial-gradient(circle, ${color}, ${color}40, transparent)`,
          boxShadow: `0 0 60px ${color}, 0 0 120px ${color}60`,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 3, 2.5, 3, 2], opacity: [0, 0.8, 0.5, 0.7, 0] }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      {/* Embers */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            width: p.size,
            height: p.size * 1.4,
            backgroundColor: p.color,
            borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
          initial={{ x: randomBetween(-20, 20), y: 0, opacity: 0, scale: 0 }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: [0, 1, 1, 0],
            scale: [0, 1.5, 1, 0],
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ─── Blizzard ────────────────────────────────────────────────────────────────

function BlizzardEffect({ color }: { color: string }) {
  const shards = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const dist = randomBetween(40, 140);
        const { x, y } = polarToXY(angle, dist);
        return {
          id: i,
          x,
          y,
          size: randomBetween(4, 10),
          rotation: randomBetween(0, 360),
          spin: randomBetween(-360, 360),
          delay: randomBetween(0, 0.15),
          color: ICE_COLORS[Math.floor(Math.random() * ICE_COLORS.length)],
        };
      }),
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {/* Frost overlay */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle, ${color}30, transparent)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0.3, 0] }}
        transition={{ duration: 0.8 }}
      />
      {/* Ice shards */}
      {shards.map((s) => (
        <motion.div
          key={s.id}
          className="absolute"
          style={{
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0, rotate: s.rotation }}
          animate={{
            x: s.x,
            y: s.y,
            opacity: [0, 1, 1, 0],
            scale: [0, 1.3, 1, 0.3],
            rotate: s.rotation + s.spin,
          }}
          transition={{ duration: 0.7, delay: s.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ─── Blackhole ───────────────────────────────────────────────────────────────

function BlackholeEffect({ color }: { color: string }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const startDist = randomBetween(80, 140);
        const { x, y } = polarToXY(angle, startDist);
        return {
          id: i,
          startX: x,
          startY: y,
          size: randomBetween(3, 8),
          delay: randomBetween(0, 0.2),
        };
      }),
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {/* Imploding ring */}
      {[0, 0.1, 0.2].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 20,
            height: 20,
            border: `2px solid ${color}`,
            boxShadow: `0 0 15px ${color}`,
          }}
          initial={{ scale: 10, opacity: 0 }}
          animate={{ scale: [10, 0], opacity: [0, 0.8, 1, 0] }}
          transition={{ duration: 0.7, delay, ease: 'easeIn' }}
        />
      ))}
      {/* Dark center */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 20,
          height: 20,
          background: `radial-gradient(circle, #000, ${color}80, transparent)`,
          boxShadow: `0 0 30px ${color}, inset 0 0 10px #000`,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 2, 3, 0], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      />
      {/* Particles getting sucked in */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: color,
            boxShadow: `0 0 ${p.size * 2}px ${color}`,
          }}
          initial={{ x: p.startX, y: p.startY, opacity: 0, scale: 1 }}
          animate={{
            x: [p.startX, 0],
            y: [p.startY, 0],
            opacity: [0, 1, 1, 0],
            scale: [1, 0.5, 0],
          }}
          transition={{ duration: 0.6, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

// ─── Main CritEffect Component ───────────────────────────────────────────────

export function CritEffect({ effect, color, active }: CritEffectProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={`crit-${effect}-${Date.now()}`}
          className="absolute inset-0 pointer-events-none z-30"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          {effect === 'shockwave' && <ShockwaveEffect color={color} />}
          {effect === 'doubleslash' && <DoubleSlashEffect color={color} />}
          {effect === 'earthquake' && <EarthquakeEffect color={color} />}
          {effect === 'overcharge' && <OverchargeEffect color={color} />}
          {effect === 'thunderstorm' && <ThunderstormEffect color={color} />}
          {effect === 'firestorm' && <FirestormEffect color={color} />}
          {effect === 'blizzard' && <BlizzardEffect color={color} />}
          {effect === 'blackhole' && <BlackholeEffect color={color} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
