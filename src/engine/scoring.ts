/**
 * Bot Trade Arena — Composite Scoring Engine
 *
 * DESIGN RATIONALE:
 * Pure win% is gameable (many tiny wins + one catastrophic loss = high win% but negative P&L).
 * We use a composite score that rewards ACTUAL trading skill:
 *   - Net P&L (did you make money?)
 *   - Profit Factor (are your wins bigger than your losses?)
 *   - Risk management (Sharpe ratio, max drawdown)
 *   - Win rate (secondary, not primary)
 *
 * The composite score is a weighted blend normalized to 0-1000 scale.
 */

export interface TradeRecord {
  pnl: number;
  side: 'LONG' | 'SHORT';
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  holdTime: number; // seconds
}

export interface BotMatchResult {
  trades: TradeRecord[];
  finalPnl: number;
  startingCapital: number;
  peakCapital: number;
  troughCapital: number;
  capitalHistory: number[]; // time series of capital at each snapshot
}

export interface ScoreBreakdown {
  compositeScore: number;    // 0-1000, the primary ranking metric
  pnlScore: number;          // 0-250
  profitFactorScore: number; // 0-250
  sharpeScore: number;       // 0-250
  riskScore: number;         // 0-150
  winRateBonus: number;      // 0-100
  penalties: number;         // Deductions for anti-gaming violations

  // Raw metrics (displayed to users)
  rawPnl: number;
  rawReturn: number;         // % return
  rawWinRate: number;        // % of winning trades
  rawProfitFactor: number;   // gross profit / gross loss
  rawSharpe: number;         // annualized Sharpe ratio
  rawMaxDrawdown: number;    // max peak-to-trough decline %
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
}

// ============================================================
// SCORING WEIGHTS
// ============================================================

const WEIGHTS = {
  PNL: 250,              // Net profitability (most important)
  PROFIT_FACTOR: 250,    // Quality of wins vs losses
  SHARPE: 250,           // Risk-adjusted returns
  RISK_MGMT: 150,        // Drawdown control
  WIN_RATE_BONUS: 100,   // Bonus for high win rate (not primary)
};

// ============================================================
// ANTI-GAMING RULES
// ============================================================

const ANTI_GAMING = {
  MIN_TRADES: 5,              // Must make at least N trades per match
  MIN_HOLD_SECONDS: 10,       // Trades held less than this = flagged
  MAX_POSITION_PCT: 0.5,      // Can't put more than 50% in one trade
  WASH_TRADE_WINDOW: 5,       // Seconds — same symbol buy/sell = wash
  MIN_UNIQUE_SYMBOLS: 1,      // Must trade at least N different symbols

  // Penalties
  LOW_TRADE_PENALTY: 200,     // Below MIN_TRADES
  WASH_TRADE_PENALTY: 50,     // Per wash trade detected
  CONCENTRATION_PENALTY: 100, // Exceeding MAX_POSITION_PCT
};

// ============================================================
// CORE SCORING FUNCTIONS
// ============================================================

/**
 * Calculate the full composite score for a bot's match performance.
 */
export function calculateScore(result: BotMatchResult): ScoreBreakdown {
  const trades = result.trades;
  const totalTrades = trades.length;

  // Handle edge case: no trades
  if (totalTrades === 0) {
    return emptyScore();
  }

  // Basic stats
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const winCount = winningTrades.length;
  const loseCount = losingTrades.length;

  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

  const rawPnl = result.finalPnl;
  const rawReturn = (rawPnl / result.startingCapital) * 100;
  const rawWinRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
  const rawProfitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 0;
  const rawSharpe = calculateSharpe(result.capitalHistory);
  const rawMaxDrawdown = calculateMaxDrawdown(result.capitalHistory);

  const avgWin = winCount > 0 ? grossProfit / winCount : 0;
  const avgLoss = loseCount > 0 ? grossLoss / loseCount : 0;

  // Score components
  const pnlScore = scorePnl(rawReturn);
  const profitFactorScore = scoreProfitFactor(rawProfitFactor);
  const sharpeScore = scoreSharpe(rawSharpe);
  const riskScore = scoreRisk(rawMaxDrawdown);
  const winRateBonus = scoreWinRate(rawWinRate, totalTrades);

  // Anti-gaming penalties
  const penalties = calculatePenalties(trades, result);

  // Composite
  const compositeScore = Math.max(0, Math.round(
    pnlScore + profitFactorScore + sharpeScore + riskScore + winRateBonus - penalties
  ));

  return {
    compositeScore,
    pnlScore: Math.round(pnlScore),
    profitFactorScore: Math.round(profitFactorScore),
    sharpeScore: Math.round(sharpeScore),
    riskScore: Math.round(riskScore),
    winRateBonus: Math.round(winRateBonus),
    penalties: Math.round(penalties),
    rawPnl,
    rawReturn: Math.round(rawReturn * 100) / 100,
    rawWinRate: Math.round(rawWinRate * 10) / 10,
    rawProfitFactor: Math.round(rawProfitFactor * 100) / 100,
    rawSharpe: Math.round(rawSharpe * 100) / 100,
    rawMaxDrawdown: Math.round(rawMaxDrawdown * 100) / 100,
    totalTrades,
    winningTrades: winCount,
    losingTrades: loseCount,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
  };
}

/**
 * Determine the match winner from two score breakdowns.
 * Returns: 1 (bot1 wins), 2 (bot2 wins), 0 (draw)
 */
export function determineWinner(
  score1: ScoreBreakdown,
  score2: ScoreBreakdown
): { winner: 0 | 1 | 2; margin: number } {
  const diff = score1.compositeScore - score2.compositeScore;

  // Draw threshold: within 10 points is a draw
  if (Math.abs(diff) <= 10) {
    return { winner: 0, margin: Math.abs(diff) };
  }

  return {
    winner: diff > 0 ? 1 : 2,
    margin: Math.abs(diff),
  };
}

// ============================================================
// COMPONENT SCORING FUNCTIONS
// ============================================================

/** Score P&L: 0-250 points. Sigmoid curve centered at 0% return. */
function scorePnl(returnPct: number): number {
  // Sigmoid: maps any return to 0-250
  // 0% return = 125 (middle), +5% = ~200, -5% = ~50
  const k = 0.4; // steepness
  const normalized = 1 / (1 + Math.exp(-k * returnPct));
  return normalized * WEIGHTS.PNL;
}

/** Score Profit Factor: 0-250 points. PF of 1.0 = break-even. */
function scoreProfitFactor(pf: number): number {
  if (pf <= 0) return 0;
  // PF 1.0 = 100pts, PF 2.0 = 175pts, PF 3.0+ = ~225pts
  const normalized = Math.min(1, Math.log(1 + pf) / Math.log(4));
  return normalized * WEIGHTS.PROFIT_FACTOR;
}

/** Score Sharpe Ratio: 0-250 points. */
function scoreSharpe(sharpe: number): number {
  // Sharpe of 0 = 0pts, 1.0 = 125pts, 2.0 = 200pts, 3.0+ = ~240pts
  if (sharpe <= 0) return Math.max(0, 50 + sharpe * 25); // Negative Sharpe still gets some credit
  const normalized = Math.min(1, sharpe / 3);
  return normalized * WEIGHTS.SHARPE;
}

/** Score Risk Management: 0-150 points based on max drawdown. */
function scoreRisk(maxDrawdownPct: number): number {
  // 0% drawdown = 150pts, 5% = 100pts, 10% = 50pts, 20%+ = 0pts
  const normalized = Math.max(0, 1 - maxDrawdownPct / 20);
  return normalized * WEIGHTS.RISK_MGMT;
}

/** Win Rate Bonus: 0-100 points. Only kicks in above 50% with enough trades. */
function scoreWinRate(winRatePct: number, tradeCount: number): number {
  // Need at least MIN_TRADES to qualify for bonus
  if (tradeCount < ANTI_GAMING.MIN_TRADES) return 0;
  // Below 50% = no bonus. 50-80% scales linearly. 80%+ = max.
  if (winRatePct <= 50) return 0;
  const normalized = Math.min(1, (winRatePct - 50) / 30);
  return normalized * WEIGHTS.WIN_RATE_BONUS;
}

// ============================================================
// ANTI-GAMING
// ============================================================

function calculatePenalties(trades: TradeRecord[], result: BotMatchResult): number {
  let penalty = 0;

  // 1. Too few trades
  if (trades.length < ANTI_GAMING.MIN_TRADES) {
    penalty += ANTI_GAMING.LOW_TRADE_PENALTY;
  }

  // 2. Wash trades (rapid same-symbol buy/sell)
  const sortedTrades = [...trades].sort((a, b) => a.holdTime - b.holdTime);
  const washTrades = sortedTrades.filter(t => t.holdTime < ANTI_GAMING.WASH_TRADE_WINDOW);
  penalty += washTrades.length * ANTI_GAMING.WASH_TRADE_PENALTY;

  // 3. Concentration risk
  const maxTradeValue = Math.max(...trades.map(t => Math.abs(t.quantity * t.entryPrice)));
  if (maxTradeValue > result.startingCapital * ANTI_GAMING.MAX_POSITION_PCT) {
    penalty += ANTI_GAMING.CONCENTRATION_PENALTY;
  }

  return penalty;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function calculateSharpe(capitalHistory: number[]): number {
  if (capitalHistory.length < 2) return 0;

  // Calculate returns
  const returns: number[] = [];
  for (let i = 1; i < capitalHistory.length; i++) {
    returns.push((capitalHistory[i] - capitalHistory[i - 1]) / capitalHistory[i - 1]);
  }

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return mean > 0 ? 3 : 0;

  // Annualize (assuming 5-second snapshots, ~17280 per day, ~252 trading days)
  const annualizationFactor = Math.sqrt(252 * 17280 / capitalHistory.length);
  return (mean / stdDev) * annualizationFactor;
}

function calculateMaxDrawdown(capitalHistory: number[]): number {
  if (capitalHistory.length < 2) return 0;

  let peak = capitalHistory[0];
  let maxDrawdown = 0;

  for (const value of capitalHistory) {
    if (value > peak) peak = value;
    const drawdown = ((peak - value) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return maxDrawdown;
}

function emptyScore(): ScoreBreakdown {
  return {
    compositeScore: 0, pnlScore: 0, profitFactorScore: 0,
    sharpeScore: 0, riskScore: 0, winRateBonus: 0, penalties: ANTI_GAMING.LOW_TRADE_PENALTY,
    rawPnl: 0, rawReturn: 0, rawWinRate: 0, rawProfitFactor: 0,
    rawSharpe: 0, rawMaxDrawdown: 0, totalTrades: 0,
    winningTrades: 0, losingTrades: 0, avgWin: 0, avgLoss: 0,
  };
}

// ============================================================
// ELO CALCULATION
// ============================================================

const ELO_K = 32; // K-factor for ELO changes

export function calculateEloChange(
  winnerElo: number,
  loserElo: number,
  isDraw: boolean = false
): { winnerChange: number; loserChange: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 - expectedWinner;

  if (isDraw) {
    return {
      winnerChange: Math.round(ELO_K * (0.5 - expectedWinner)),
      loserChange: Math.round(ELO_K * (0.5 - expectedLoser)),
    };
  }

  return {
    winnerChange: Math.round(ELO_K * (1 - expectedWinner)),
    loserChange: Math.round(ELO_K * (0 - expectedLoser)),
  };
}

/** Determine tier from ELO rating */
export function eloToTier(elo: number): string {
  if (elo >= 2000) return 'DIAMOND';
  if (elo >= 1600) return 'PLATINUM';
  if (elo >= 1300) return 'GOLD';
  if (elo >= 1100) return 'SILVER';
  return 'BRONZE';
}
