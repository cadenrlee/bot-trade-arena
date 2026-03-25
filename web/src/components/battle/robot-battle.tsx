'use client';
import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Robot Battle Visualization
 *
 * Two robots fight on screen. The battle is directly tied to trading:
 *   - Profitable trade = your robot attacks (punch animation + damage flash)
 *   - Losing trade = your robot takes a hit (recoil + red flash)
 *   - Health bars = P&L percentage (start at 50/50, shift based on gains)
 *   - Winner = whoever has the higher % gain at the end
 *   - Critical hits when a trade is especially profitable
 *   - Idle bounce animation between trades
 */

interface BotFighter {
  name: string;
  pnl: number;
  pnlPct: number;
  trades: number;
  wins: number;
  losses: number;
  color: string;
}

interface TradeEvent {
  botIndex: 0 | 1; // which bot made the trade
  isWin: boolean;
  pnl: number;
  symbol: string;
}

interface RobotBattleProps {
  bot1: BotFighter;
  bot2: BotFighter;
  lastTrade?: TradeEvent | null;
  timeRemaining: number;
  duration: number;
  matchOver?: boolean;
  winner?: 0 | 1 | null; // null = draw
}

export function RobotBattle({ bot1, bot2, lastTrade, timeRemaining, duration, matchOver, winner }: RobotBattleProps) {
  const [bot1Action, setBot1Action] = useState<'idle' | 'attack' | 'hit' | 'win' | 'lose'>('idle');
  const [bot2Action, setBot2Action] = useState<'idle' | 'attack' | 'hit' | 'win' | 'lose'>('idle');
  const [damageText1, setDamageText1] = useState<string | null>(null);
  const [damageText2, setDamageText2] = useState<string | null>(null);
  const [shakeScreen, setShakeScreen] = useState(false);

  // React to trades
  useEffect(() => {
    if (!lastTrade) return;

    const isCritical = Math.abs(lastTrade.pnl) > 50;

    if (lastTrade.botIndex === 0) {
      if (lastTrade.isWin) {
        setBot1Action('attack');
        setBot2Action('hit');
        setDamageText2(`-$${Math.abs(lastTrade.pnl).toFixed(0)}`);
        if (isCritical) setShakeScreen(true);
      } else {
        setBot1Action('hit');
        setBot2Action('attack');
        setDamageText1(`-$${Math.abs(lastTrade.pnl).toFixed(0)}`);
      }
    } else {
      if (lastTrade.isWin) {
        setBot2Action('attack');
        setBot1Action('hit');
        setDamageText1(`-$${Math.abs(lastTrade.pnl).toFixed(0)}`);
        if (isCritical) setShakeScreen(true);
      } else {
        setBot2Action('hit');
        setBot1Action('attack');
        setDamageText2(`-$${Math.abs(lastTrade.pnl).toFixed(0)}`);
      }
    }

    const timer = setTimeout(() => {
      setBot1Action(matchOver ? (winner === 0 ? 'win' : winner === 1 ? 'lose' : 'idle') : 'idle');
      setBot2Action(matchOver ? (winner === 1 ? 'win' : winner === 0 ? 'lose' : 'idle') : 'idle');
      setDamageText1(null);
      setDamageText2(null);
      setShakeScreen(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [lastTrade, matchOver, winner]);

  // Match over
  useEffect(() => {
    if (matchOver) {
      setBot1Action(winner === 0 ? 'win' : winner === 1 ? 'lose' : 'idle');
      setBot2Action(winner === 1 ? 'win' : winner === 0 ? 'lose' : 'idle');
    }
  }, [matchOver, winner]);

  // Health bars based on P&L percentage
  const totalPnl = Math.abs(bot1.pnlPct) + Math.abs(bot2.pnlPct) || 1;
  const bot1Health = 50 + (bot1.pnlPct - bot2.pnlPct) * 2; // Centered at 50
  const clampedBot1 = Math.max(5, Math.min(95, bot1Health));

  const elapsed = duration - timeRemaining;
  const timePct = duration > 0 ? (elapsed / duration) * 100 : 0;

  return (
    <div className={cn('relative', shakeScreen && 'animate-shake')}>
      <style jsx>{`
        @keyframes idle-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes attack-left {
          0% { transform: translateX(0); }
          30% { transform: translateX(60px) rotate(10deg); }
          60% { transform: translateX(30px); }
          100% { transform: translateX(0); }
        }
        @keyframes attack-right {
          0% { transform: translateX(0); }
          30% { transform: translateX(-60px) rotate(-10deg); }
          60% { transform: translateX(-30px); }
          100% { transform: translateX(0); }
        }
        @keyframes hit-left {
          0% { transform: translateX(0); }
          20% { transform: translateX(-20px) rotate(-5deg); }
          100% { transform: translateX(0); }
        }
        @keyframes hit-right {
          0% { transform: translateX(0); }
          20% { transform: translateX(20px) rotate(5deg); }
          100% { transform: translateX(0); }
        }
        @keyframes win-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.1); }
        }
        @keyframes damage-float {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-40px); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
        .robot-idle { animation: idle-bounce 2s ease-in-out infinite; }
        .robot-attack-l { animation: attack-left 0.5s ease-out; }
        .robot-attack-r { animation: attack-right 0.5s ease-out; }
        .robot-hit-l { animation: hit-left 0.4s ease-out; }
        .robot-hit-r { animation: hit-right 0.4s ease-out; }
        .robot-win { animation: win-bounce 0.8s ease-in-out infinite; }
        .damage-text { animation: damage-float 0.8s ease-out forwards; }
      `}</style>

      {/* Arena background */}
      <div className="rounded-2xl bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-secondary)] border border-[var(--border-default)] p-6 overflow-hidden">

        {/* Timer bar */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs text-[var(--text-tertiary)]">{formatTime(elapsed)}</span>
          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple)] transition-all duration-1000"
              style={{ width: `${timePct}%` }}
            />
          </div>
          <span className="text-xs font-[var(--font-mono)] text-[var(--text-secondary)]">{formatTime(timeRemaining)}</span>
        </div>

        {/* Health bar */}
        <div className="mb-6 relative h-8 rounded-full overflow-hidden bg-[var(--bg-primary)] border border-[var(--border-default)]">
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[var(--accent-indigo)] to-indigo-400 transition-all duration-500"
            style={{ width: `${clampedBot1}%` }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-[var(--accent-emerald)] to-emerald-400 transition-all duration-500"
            style={{ width: `${100 - clampedBot1}%` }}
          />
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
          {/* Labels */}
          <div className="absolute inset-0 flex items-center justify-between px-4">
            <span className="text-xs font-bold text-white drop-shadow-md font-[var(--font-mono)]">
              {bot1.pnlPct >= 0 ? '+' : ''}{bot1.pnlPct.toFixed(2)}%
            </span>
            <span className="text-xs font-bold text-white drop-shadow-md font-[var(--font-mono)]">
              {bot2.pnlPct >= 0 ? '+' : ''}{bot2.pnlPct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Battle arena */}
        <div className="relative h-48 flex items-end justify-between px-8">
          {/* Bot 1 (left) */}
          <div className="relative flex flex-col items-center">
            {damageText1 && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[var(--accent-red)] font-bold font-[var(--font-mono)] text-lg damage-text">
                {damageText1}
              </div>
            )}
            <div className={cn(
              'text-6xl select-none',
              bot1Action === 'idle' && 'robot-idle',
              bot1Action === 'attack' && 'robot-attack-l',
              bot1Action === 'hit' && 'robot-hit-l',
              bot1Action === 'win' && 'robot-win',
              bot1Action === 'lose' && 'opacity-50',
            )}>
              <div className={cn(
                'w-24 h-28 rounded-2xl flex items-center justify-center text-3xl font-bold transition-colors duration-200',
                bot1Action === 'hit' ? 'bg-red-500/30' : 'bg-[var(--accent-indigo)]/20',
                'border-2',
                bot1Action === 'hit' ? 'border-red-500/50' : 'border-[var(--accent-indigo)]/50',
              )}>
                {/* Robot face */}
                <div className="text-center">
                  <div className="flex gap-2 justify-center mb-1">
                    <div className="w-3 h-3 rounded-full bg-[var(--accent-indigo)]" />
                    <div className="w-3 h-3 rounded-full bg-[var(--accent-indigo)]" />
                  </div>
                  <div className={cn(
                    'w-8 h-1.5 rounded-full mx-auto',
                    bot1Action === 'win' ? 'bg-[var(--accent-emerald)]' :
                    bot1Action === 'hit' ? 'bg-[var(--accent-red)]' : 'bg-[var(--accent-indigo)]/60'
                  )} />
                  <div className="mt-2 text-xs font-[var(--font-mono)] text-[var(--accent-indigo)]">
                    {bot1.wins}W
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--text-primary)] truncate max-w-[100px]">{bot1.name}</p>
            <p className="text-xs font-[var(--font-mono)]" style={{ color: bot1.pnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
              {bot1.pnl >= 0 ? '+' : ''}${bot1.pnl.toFixed(2)}
            </p>
          </div>

          {/* VS */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {matchOver ? (
              <div className="text-2xl font-black text-[var(--accent-amber)] font-[var(--font-display)]">
                {winner === null ? 'DRAW' : 'KO!'}
              </div>
            ) : (
              <div className="text-lg font-bold text-[var(--text-tertiary)]">VS</div>
            )}
          </div>

          {/* Bot 2 (right) */}
          <div className="relative flex flex-col items-center">
            {damageText2 && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[var(--accent-red)] font-bold font-[var(--font-mono)] text-lg damage-text">
                {damageText2}
              </div>
            )}
            <div className={cn(
              'text-6xl select-none',
              bot2Action === 'idle' && 'robot-idle',
              bot2Action === 'attack' && 'robot-attack-r',
              bot2Action === 'hit' && 'robot-hit-r',
              bot2Action === 'win' && 'robot-win',
              bot2Action === 'lose' && 'opacity-50',
            )}>
              <div className={cn(
                'w-24 h-28 rounded-2xl flex items-center justify-center text-3xl font-bold transition-colors duration-200',
                bot2Action === 'hit' ? 'bg-red-500/30' : 'bg-[var(--accent-emerald)]/20',
                'border-2',
                bot2Action === 'hit' ? 'border-red-500/50' : 'border-[var(--accent-emerald)]/50',
              )}>
                <div className="text-center">
                  <div className="flex gap-2 justify-center mb-1">
                    <div className="w-3 h-3 rounded-full bg-[var(--accent-emerald)]" />
                    <div className="w-3 h-3 rounded-full bg-[var(--accent-emerald)]" />
                  </div>
                  <div className={cn(
                    'w-8 h-1.5 rounded-full mx-auto',
                    bot2Action === 'win' ? 'bg-[var(--accent-emerald)]' :
                    bot2Action === 'hit' ? 'bg-[var(--accent-red)]' : 'bg-[var(--accent-emerald)]/60'
                  )} />
                  <div className="mt-2 text-xs font-[var(--font-mono)] text-[var(--accent-emerald)]">
                    {bot2.wins}W
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--text-primary)] truncate max-w-[100px]">{bot2.name}</p>
            <p className="text-xs font-[var(--font-mono)]" style={{ color: bot2.pnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
              {bot2.pnl >= 0 ? '+' : ''}${bot2.pnl.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Trade feed */}
        <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
          <span>{bot1.trades} trades</span>
          <span className="font-[var(--font-mono)]">Winner = highest % gain</span>
          <span>{bot2.trades} trades</span>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
