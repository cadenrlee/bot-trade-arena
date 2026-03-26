'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPnl, formatDuration } from '@/lib/utils';

interface MatchSnapshot {
  bot1Pnl: number;
  bot1Score: number;
  bot1Trades: number;
  bot1Wins: number;
  bot1OpenPos: number;
  bot1Cash: number;
  bot2Pnl: number;
  bot2Score: number;
  bot2Trades: number;
  bot2Wins: number;
  bot2OpenPos: number;
  bot2Cash: number;
  marketPrices: any;
  elapsed: number;
  timestamp: string;
}

const SPEEDS = [0.5, 1, 2, 4];

export default function MatchReplayPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<any>(null);
  const [frames, setFrames] = useState<MatchSnapshot[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch data
  useEffect(() => {
    Promise.all([
      api.getMatch(matchId),
      api.getMatchReplay(matchId),
    ])
      .then(([matchData, replayData]) => {
        setMatch(matchData);
        setFrames(replayData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load replay');
        setLoading(false);
      });
  }, [matchId]);

  // Auto-advance timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    stopTimer();
    if (!playing || frames.length === 0) return;

    // Calculate interval between frames. Default ~1s per frame, scaled by speed.
    const baseInterval = frames.length > 1
      ? Math.max(100, ((frames[frames.length - 1].elapsed - frames[0].elapsed) / frames.length) * 1000)
      : 1000;
    const interval = baseInterval / speed;

    timerRef.current = setInterval(() => {
      setFrameIndex((prev) => {
        if (prev >= frames.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, Math.max(50, interval));

    return stopTimer;
  }, [playing, speed, frames, stopTimer]);

  const togglePlay = () => {
    if (frameIndex >= frames.length - 1) {
      setFrameIndex(0);
      setPlaying(true);
    } else {
      setPlaying(!playing);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-[var(--accent-indigo)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !match || frames.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-[var(--text-secondary)]">{error || 'No replay data available.'}</p>
        <Link href={`/matches/${matchId}`}>
          <Button variant="secondary">Back to Match</Button>
        </Link>
      </div>
    );
  }

  const frame = frames[frameIndex];
  const isLastFrame = frameIndex === frames.length - 1;
  const b1Name = match.bot1?.name || 'Bot 1';
  const b2Name = match.bot2?.name || 'Bot 2';

  // Determine winner at end
  const b1FinalPnl = frames[frames.length - 1].bot1Pnl;
  const b2FinalPnl = frames[frames.length - 1].bot2Pnl;
  const winner = b1FinalPnl > b2FinalPnl ? b1Name : b2FinalPnl > b1FinalPnl ? b2Name : null;

  // Build P&L history for chart
  const pnlHistory1 = frames.slice(0, frameIndex + 1).map((f) => f.bot1Pnl);
  const pnlHistory2 = frames.slice(0, frameIndex + 1).map((f) => f.bot2Pnl);

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/matches/${matchId}`}
              className="text-sm text-[var(--accent-indigo)] hover:underline"
            >
              &larr; Back to match
            </Link>
            <h1 className="text-xl font-bold font-[family-name:var(--font-display)] mt-1">
              Match Replay
            </h1>
            <p className="text-xs text-[var(--text-tertiary)] font-[family-name:var(--font-mono)]">
              {b1Name} vs {b2Name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--text-tertiary)]">
              Frame {frameIndex + 1} / {frames.length}
            </p>
            <p className="text-sm font-bold font-[family-name:var(--font-mono)]">
              {formatDuration(frame.elapsed)}
            </p>
          </div>
        </div>

        {/* Controls */}
        <Card hover={false} className="p-4">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-[var(--accent-indigo)] text-white flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer"
            >
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="2" width="4" height="12" rx="1" />
                  <rect x="9" y="2" width="4" height="12" rx="1" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2l10 6-10 6V2z" />
                </svg>
              )}
            </button>

            {/* Progress slider */}
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={frameIndex}
              onChange={(e) => {
                setFrameIndex(parseInt(e.target.value));
                setPlaying(false);
              }}
              className="flex-1 h-2 appearance-none bg-[var(--bg-primary)] rounded-full cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent-indigo)]
                [&::-webkit-slider-thumb]:cursor-pointer"
            />

            {/* Speed controls */}
            <div className="flex gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-bold font-[family-name:var(--font-mono)] transition-colors cursor-pointer ${
                    speed === s
                      ? 'bg-[var(--accent-indigo)] text-white'
                      : 'bg-[var(--bg-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Bot stats side by side */}
        <div className="grid grid-cols-2 gap-4">
          <BotCard
            name={b1Name}
            color="var(--accent-indigo)"
            pnl={frame.bot1Pnl}
            score={frame.bot1Score}
            trades={frame.bot1Trades}
            openPos={frame.bot1OpenPos}
            cash={frame.bot1Cash}
          />
          <BotCard
            name={b2Name}
            color="var(--accent-emerald)"
            pnl={frame.bot2Pnl}
            score={frame.bot2Score}
            trades={frame.bot2Trades}
            openPos={frame.bot2OpenPos}
            cash={frame.bot2Cash}
          />
        </div>

        {/* P&L Chart */}
        <Card hover={false} className="p-5">
          <CardTitle className="mb-3">P&L Over Time</CardTitle>
          <PnlChart
            data1={pnlHistory1}
            data2={pnlHistory2}
            label1={b1Name}
            label2={b2Name}
          />
        </Card>

        {/* Winner announcement */}
        {isLastFrame && (
          <Card hover={false} className="p-6 text-center">
            <h2
              className="text-3xl font-black font-[family-name:var(--font-display)] mb-2"
              style={{
                background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple), var(--accent-emerald))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {winner ? `${winner} WINS!` : 'DRAW!'}
            </h2>
            <div className="flex justify-center gap-10 mb-4">
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">{b1Name}</p>
                <p className="text-xl font-black font-[family-name:var(--font-mono)]" style={{ color: 'var(--accent-indigo)' }}>
                  {formatPnl(b1FinalPnl)}
                </p>
              </div>
              <div className="self-center text-[var(--text-tertiary)]">vs</div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">{b2Name}</p>
                <p className="text-xl font-black font-[family-name:var(--font-mono)]" style={{ color: 'var(--accent-emerald)' }}>
                  {formatPnl(b2FinalPnl)}
                </p>
              </div>
            </div>
            <Link href={`/matches/${matchId}`}>
              <Button variant="secondary">Back to Match</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---- Bot stat card ----
function BotCard({
  name,
  color,
  pnl,
  score,
  trades,
  openPos,
  cash,
}: {
  name: string;
  color: string;
  pnl: number;
  score: number;
  trades: number;
  openPos: number;
  cash: number;
}) {
  const pnlColor = pnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)';

  return (
    <Card hover={false} className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
        <h3 className="text-sm font-bold truncate">{name}</h3>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-[var(--text-tertiary)]">P&L</span>
          <span
            className="text-lg font-black font-[family-name:var(--font-mono)]"
            style={{ color: pnlColor }}
          >
            {formatPnl(pnl)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-[var(--text-tertiary)]">Score</span>
          <span className="text-sm font-bold font-[family-name:var(--font-mono)]">{score}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-[var(--text-tertiary)]">Trades</span>
          <span className="text-sm font-[family-name:var(--font-mono)]">{trades}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-[var(--text-tertiary)]">Open Positions</span>
          <span className="text-sm font-[family-name:var(--font-mono)]">{openPos}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-[var(--text-tertiary)]">Cash</span>
          <span className="text-sm font-[family-name:var(--font-mono)]">${cash?.toLocaleString() ?? '0'}</span>
        </div>
      </div>
    </Card>
  );
}

// ---- SVG P&L line chart ----
function PnlChart({
  data1,
  data2,
  label1,
  label2,
}: {
  data1: number[];
  data2: number[];
  label1: string;
  label2: string;
}) {
  if (data1.length < 2) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-[var(--text-tertiary)]">
        Not enough data to chart yet
      </div>
    );
  }

  const width = 600;
  const height = 200;
  const padX = 50;
  const padY = 20;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const allVals = [...data1, ...data2];
  const minVal = Math.min(...allVals, 0);
  const maxVal = Math.max(...allVals, 0);
  const range = maxVal - minVal || 1;

  const toX = (i: number) => padX + (i / Math.max(data1.length - 1, 1)) * chartW;
  const toY = (v: number) => padY + chartH - ((v - minVal) / range) * chartH;

  const makePath = (data: number[]) =>
    data.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');

  const zeroY = toY(0);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 400 }}>
        {/* Zero line */}
        <line
          x1={padX}
          y1={zeroY}
          x2={width - padX}
          y2={zeroY}
          stroke="var(--border-default)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <text x={padX - 6} y={zeroY + 4} textAnchor="end" fill="var(--text-tertiary)" fontSize="10">
          $0
        </text>

        {/* Y axis labels */}
        <text x={padX - 6} y={padY + 4} textAnchor="end" fill="var(--text-tertiary)" fontSize="10">
          ${maxVal >= 0 ? '+' : ''}{maxVal.toFixed(0)}
        </text>
        <text x={padX - 6} y={height - padY + 4} textAnchor="end" fill="var(--text-tertiary)" fontSize="10">
          ${minVal >= 0 ? '+' : ''}{minVal.toFixed(0)}
        </text>

        {/* Bot 1 line */}
        <path d={makePath(data1)} fill="none" stroke="var(--accent-indigo)" strokeWidth="2.5" strokeLinejoin="round" />
        {/* Bot 2 line */}
        <path d={makePath(data2)} fill="none" stroke="var(--accent-emerald)" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Current frame dots */}
        <circle cx={toX(data1.length - 1)} cy={toY(data1[data1.length - 1])} r="4" fill="var(--accent-indigo)" />
        <circle cx={toX(data2.length - 1)} cy={toY(data2[data2.length - 1])} r="4" fill="var(--accent-emerald)" />
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded bg-[var(--accent-indigo)]" />
          <span className="text-xs text-[var(--text-tertiary)]">{label1}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded bg-[var(--accent-emerald)]" />
          <span className="text-xs text-[var(--text-tertiary)]">{label2}</span>
        </div>
      </div>
    </div>
  );
}
