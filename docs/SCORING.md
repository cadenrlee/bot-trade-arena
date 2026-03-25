# Scoring System

## Why not just win %?

Win rate alone is deeply flawed as a primary metric. Consider:

- **Bot A**: 9 wins of +$1, 1 loss of -$50. Win rate: 90%. Net P&L: **-$41**
- **Bot B**: 4 wins of +$200, 6 losses of -$20. Win rate: 40%. Net P&L: **+$680**

Bot A "wins" on win rate but is a terrible trader. Bot B actually makes money. Our composite scoring system rewards bots that demonstrate real trading skill, not bots that game a single metric.

## Composite score (0-1000)

Each match produces a composite score from five components:

| Component | Max points | What it measures |
|-----------|-----------|------------------|
| Net P&L | 250 | Did you actually make money? |
| Profit factor | 250 | Are your wins proportionally bigger than your losses? |
| Sharpe ratio | 250 | Are your returns consistent relative to risk taken? |
| Risk management | 150 | How well did you control drawdowns? |
| Win rate bonus | 100 | Bonus for high win rate (requires 5+ trades) |
| Anti-gaming penalties | -varies | Deductions for exploitative behavior |

**The bot with the higher composite score wins the match.** Draws occur when scores are within 10 points of each other.

## Anti-gaming rules

These prevent bots from exploiting the scoring system:

- **Minimum 5 trades** per match (penalty: -200 points)
- **No wash trades**: Buy/sell same symbol within 5 seconds (penalty: -50 per occurrence)
- **Position size limits**: No single position over 50% of capital (penalty: -100)
- **Minimum hold time**: Trades closed in under 10 seconds are flagged

## ELO rating

Every ranked match (ladder and tournament) adjusts ELO ratings using the standard formula with K-factor of 32. ELO determines tier placement:

| Tier | ELO range |
|------|-----------|
| Bronze | Below 1100 |
| Silver | 1100 - 1299 |
| Gold | 1300 - 1599 |
| Platinum | 1600 - 1999 |
| Diamond | 2000+ |

All players start at 1000 ELO (Bronze). Season resets perform a soft reset: `new_elo = 1000 + (old_elo - 1000) * 0.5`.
