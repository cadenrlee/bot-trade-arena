'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TradeEvent {
  id: string;
  botId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  price: number;
  pnl: number;
  timestamp: number;
}

interface TradeFeedProps {
  trades: TradeEvent[];
  bot1Name: string;
  bot2Name: string;
}

const MAX_VISIBLE = 50;

export function TradeFeed({ trades, bot1Name, bot2Name }: TradeFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleTrades = trades.slice(-MAX_VISIBLE);

  // Auto-scroll to bottom on new trade
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visibleTrades.length]);

  return (
    <div className="flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Trade Feed</h3>
        <span className="text-xs text-[var(--text-tertiary)]">{visibleTrades.length} trades</span>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto max-h-[400px] space-y-0.5 p-2">
        {visibleTrades.map((trade, i) => {
          const isNew = i === visibleTrades.length - 1;
          const isPositive = trade.pnl >= 0;
          const botName = trade.botId === 'bot1' ? bot1Name : bot2Name;

          return (
            <div
              key={trade.id}
              className={cn(
                'trade-feed-item flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                'bg-[var(--bg-primary)]',
                isNew && isPositive && 'trade-pulse-green',
                isNew && !isPositive && 'trade-pulse-red',
              )}
            >
              {/* Bot name */}
              <span className="w-24 truncate font-medium text-[var(--text-primary)]">
                {botName}
              </span>

              {/* Symbol */}
              <span className="w-16 font-[var(--font-mono)] text-xs text-[var(--text-secondary)]">
                {trade.symbol}
              </span>

              {/* Side badge */}
              <span
                className={cn(
                  'w-14 rounded-md px-2 py-0.5 text-center text-xs font-bold uppercase',
                  trade.side === 'LONG'
                    ? 'bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]'
                    : 'bg-[var(--accent-red,#ef4444)]/15 text-[var(--accent-red,#ef4444)]',
                )}
              >
                {trade.side}
              </span>

              {/* Price */}
              <span className="flex-1 text-right font-[var(--font-mono)] text-xs text-[var(--text-secondary)]">
                ${trade.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>

              {/* P&L */}
              <span
                className="w-20 text-right font-[var(--font-mono)] text-xs font-semibold"
                style={{ color: isPositive ? 'var(--accent-emerald)' : 'var(--accent-red, #ef4444)' }}
              >
                {isPositive ? '+' : ''}${trade.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          );
        })}

        {visibleTrades.length === 0 && (
          <div className="flex h-24 items-center justify-center text-sm text-[var(--text-tertiary)]">
            Waiting for trades...
          </div>
        )}
      </div>

      <style jsx global>{`
        .trade-feed-item {
          animation: trade-slide-in 300ms ease-out;
        }

        @keyframes trade-slide-in {
          from {
            transform: translateX(40px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .trade-pulse-green {
          animation: trade-slide-in 300ms ease-out, pulse-green 600ms ease-out;
        }

        .trade-pulse-red {
          animation: trade-slide-in 300ms ease-out, pulse-red 600ms ease-out;
        }

        @keyframes pulse-green {
          0% { background-color: rgba(16, 185, 129, 0.2); }
          100% { background-color: transparent; }
        }

        @keyframes pulse-red {
          0% { background-color: rgba(239, 68, 68, 0.2); }
          100% { background-color: transparent; }
        }
      `}</style>
    </div>
  );
}
