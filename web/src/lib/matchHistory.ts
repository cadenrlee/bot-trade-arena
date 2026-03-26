/**
 * Match History — stores last 20 Quick Battles in localStorage
 * and syncs to server if user is authenticated.
 */

export interface MatchRecord {
  id: string;
  timestamp: number;
  opponent: string;
  opponentElo: number;
  myPnl: number;
  oppPnl: number;
  myPnlPct: number;
  oppPnlPct: number;
  myTrades: number;
  oppTrades: number;
  won: boolean;
  eloChange: number;
  newElo: number;
  strategy: string;
  eventsCaught: number;
  eventsMissed: number;
  xpEarned: number;
  isMultiplayer: boolean;
}

const isBrowser = typeof window !== 'undefined';
const MAX_HISTORY = 20;

export function getMatchHistory(): MatchRecord[] {
  if (!isBrowser) return [];
  try {
    return JSON.parse(localStorage.getItem('bta_match_history') || '[]');
  } catch { return []; }
}

export function addMatchToHistory(match: MatchRecord): void {
  if (!isBrowser) return;
  const history = getMatchHistory();
  history.unshift(match);
  if (history.length > MAX_HISTORY) history.pop();
  localStorage.setItem('bta_match_history', JSON.stringify(history));
}

export function getMatchStats() {
  const history = getMatchHistory();
  if (history.length === 0) return { totalMatches: 0, wins: 0, losses: 0, winRate: 0, avgPnl: 0, bestMatch: null, worstMatch: null, totalEventsC: 0, totalEventsM: 0 };

  const wins = history.filter(m => m.won).length;
  const avgPnl = history.reduce((s, m) => s + m.myPnl, 0) / history.length;
  const best = history.reduce((a, b) => a.myPnl > b.myPnl ? a : b);
  const worst = history.reduce((a, b) => a.myPnl < b.myPnl ? a : b);
  const totalEventsC = history.reduce((s, m) => s + m.eventsCaught, 0);
  const totalEventsM = history.reduce((s, m) => s + m.eventsMissed, 0);

  return {
    totalMatches: history.length,
    wins,
    losses: history.length - wins,
    winRate: Math.round((wins / history.length) * 100),
    avgPnl: Math.round(avgPnl * 100) / 100,
    bestMatch: best,
    worstMatch: worst,
    totalEventsC,
    totalEventsM,
  };
}
