'use client';
import { create } from 'zustand';

interface BotTickState {
  botId: string;
  pnl: number;
  totalCapital: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  openPositions: number;
}

interface MatchTickData {
  elapsed: number;
  remaining: number;
  prices: Record<string, number>;
  bot1: BotTickState;
  bot2: BotTickState;
}

interface TradeEvent {
  botId: string;
  type: 'OPEN' | 'CLOSE';
  symbol: string;
  side: string;
  price: number;
  pnl?: number;
  isWin?: boolean;
  elapsed: number;
}

interface MatchState {
  activeMatchId: string | null;
  matchData: any | null;
  currentTick: MatchTickData | null;
  trades: TradeEvent[];
  pnlHistory: { elapsed: number; bot1: number; bot2: number }[];
  spectatorCount: number;
  setActiveMatch: (id: string, data: any) => void;
  updateTick: (tick: MatchTickData) => void;
  addTrade: (trade: TradeEvent) => void;
  setSpectatorCount: (count: number) => void;
  clearMatch: () => void;
}

export const useMatchStore = create<MatchState>((set) => ({
  activeMatchId: null,
  matchData: null,
  currentTick: null,
  trades: [],
  pnlHistory: [],
  spectatorCount: 0,

  setActiveMatch: (id, data) => set({
    activeMatchId: id,
    matchData: data,
    currentTick: null,
    trades: [],
    pnlHistory: [],
  }),

  updateTick: (tick) => set((state) => ({
    currentTick: tick,
    pnlHistory: [
      ...state.pnlHistory,
      { elapsed: tick.elapsed, bot1: tick.bot1.pnl, bot2: tick.bot2.pnl },
    ],
  })),

  addTrade: (trade) => set((state) => ({
    trades: [...state.trades, trade],
  })),

  setSpectatorCount: (count) => set({ spectatorCount: count }),

  clearMatch: () => set({
    activeMatchId: null,
    matchData: null,
    currentTick: null,
    trades: [],
    pnlHistory: [],
    spectatorCount: 0,
  }),
}));
