/**
 * Bot Trade Arena — API Routes
 *
 * RESTful API for the platform. WebSocket endpoints are separate.
 */

import { Router } from 'express';

const router = Router();

// ============================================================
// AUTH
// ============================================================

// POST /api/auth/register        — Create account
// POST /api/auth/login            — Login, returns JWT
// POST /api/auth/refresh          — Refresh access token
// POST /api/auth/forgot-password  — Send password reset email
// POST /api/auth/reset-password   — Reset password with token

// ============================================================
// USERS
// ============================================================

// GET    /api/users/me                    — Current user profile
// PATCH  /api/users/me                    — Update profile
// GET    /api/users/:username             — Public profile
// GET    /api/users/:username/stats       — User stats & match history
// GET    /api/users/:username/bots        — User's public bots
// POST   /api/users/:username/follow      — Follow user
// DELETE /api/users/:username/follow      — Unfollow user
// GET    /api/users/me/followers          — My followers
// GET    /api/users/me/following          — Who I follow
// GET    /api/users/me/achievements       — My achievements

// ============================================================
// BOTS
// ============================================================

// GET    /api/bots                        — List my bots
// POST   /api/bots                        — Create a new bot
// GET    /api/bots/:botId                 — Get bot details
// PATCH  /api/bots/:botId                 — Update bot
// DELETE /api/bots/:botId                 — Delete bot
// POST   /api/bots/:botId/regenerate-key  — Regenerate API key
// GET    /api/bots/:botId/stats           — Bot lifetime stats
// GET    /api/bots/:botId/matches         — Bot match history
// GET    /api/bots/:botId/trades          — Bot trade history

// ============================================================
// MATCHES
// ============================================================

// POST   /api/matches/queue               — Join matchmaking queue
// DELETE /api/matches/queue               — Leave matchmaking queue
// GET    /api/matches/queue/status        — Queue position & wait time
// GET    /api/matches/live                — List currently live matches
// GET    /api/matches/:matchId            — Match details
// GET    /api/matches/:matchId/trades     — All trades in a match
// GET    /api/matches/:matchId/replay     — Replay snapshots for a match
// GET    /api/matches/:matchId/score      — Detailed score breakdown

// ============================================================
// TOURNAMENTS
// ============================================================

// GET    /api/tournaments                 — List tournaments
// GET    /api/tournaments/:id             — Tournament details + bracket
// POST   /api/tournaments/:id/register    — Register for tournament
// DELETE /api/tournaments/:id/register    — Withdraw from tournament
// GET    /api/tournaments/:id/matches     — Tournament matches
// GET    /api/tournaments/:id/standings   — Current standings

// ============================================================
// LEADERBOARDS
// ============================================================

// GET    /api/leaderboards/daily          — Today's leaderboard
// GET    /api/leaderboards/weekly         — This week's leaderboard
// GET    /api/leaderboards/monthly        — This month's leaderboard
// GET    /api/leaderboards/season         — Current season leaderboard
// GET    /api/leaderboards/all-time       — All-time leaderboard
// GET    /api/leaderboards/clans          — Clan leaderboard

// Query params for all: ?tier=GOLD&page=1&limit=50

// ============================================================
// SEASONS
// ============================================================

// GET    /api/seasons                     — List all seasons
// GET    /api/seasons/current             — Current active season
// GET    /api/seasons/:id                 — Season details
// GET    /api/seasons/:id/rewards         — Season rewards info
// POST   /api/seasons/:id/claim           — Claim season rewards

// ============================================================
// CHALLENGES (Solo Mode)
// ============================================================

// GET    /api/challenges                  — List available challenges
// GET    /api/challenges/daily            — Today's daily challenge
// GET    /api/challenges/:id              — Challenge details
// POST   /api/challenges/:id/start        — Start a challenge run
// GET    /api/challenges/:id/leaderboard  — Challenge leaderboard
// GET    /api/challenges/my-runs          — My challenge history

// ============================================================
// CLANS
// ============================================================

// GET    /api/clans                       — List clans
// POST   /api/clans                       — Create a clan
// GET    /api/clans/:id                   — Clan details
// PATCH  /api/clans/:id                   — Update clan (owner only)
// POST   /api/clans/:id/join              — Join a clan
// DELETE /api/clans/:id/leave             — Leave a clan
// GET    /api/clans/:id/members           — Clan members
// GET    /api/clans/:id/stats             — Clan aggregate stats

// ============================================================
// SANDBOX (Practice Mode)
// ============================================================

// POST   /api/sandbox/start               — Start a sandbox session
// POST   /api/sandbox/trade               — Execute a trade in sandbox
// GET    /api/sandbox/state               — Current sandbox state
// POST   /api/sandbox/reset               — Reset sandbox

// ============================================================
// BILLING
// ============================================================

// GET    /api/billing/plans               — Available plans
// POST   /api/billing/subscribe           — Subscribe to a plan
// POST   /api/billing/cancel              — Cancel subscription
// GET    /api/billing/invoices            — Invoice history
// POST   /api/billing/webhook             — Stripe webhook handler

// ============================================================
// WEBSOCKET EVENTS (ws://host/ws)
// ============================================================

/*
Client -> Server:
  { type: "auth", token: "jwt..." }
  { type: "subscribe:match", matchId: "..." }
  { type: "subscribe:queue", tier: "GOLD" }
  { type: "subscribe:leaderboard", period: "daily" }
  { type: "unsubscribe:match", matchId: "..." }

Server -> Client:
  { type: "match:tick", data: { elapsed, bot1, bot2, prices } }
  { type: "match:trade", data: { botId, symbol, side, price, pnl, ... } }
  { type: "match:end", data: { winner, scores, eloChanges } }
  { type: "match:found", data: { matchId, opponent } }
  { type: "queue:update", data: { position, estimatedWait } }
  { type: "leaderboard:update", data: { entries } }
  { type: "achievement:unlocked", data: { achievement } }
  { type: "notification", data: { message } }

Bot API WebSocket (ws://host/bot-ws):
  Bot -> Server:
    { type: "auth", apiKey: "..." }
    { type: "order", data: { symbol, side, action, quantity, positionId? } }
  Server -> Bot:
    { type: "match:start", data: { matchId, opponent, symbols, duration, capital } }
    { type: "market:tick", data: { symbol, price, volume, timestamp } }
    { type: "order:result", data: { success, tradeId?, error? } }
    { type: "state:update", data: { cash, positions, pnl, trades, wins, losses } }
    { type: "match:end", data: { winner, score } }
*/

export default router;
