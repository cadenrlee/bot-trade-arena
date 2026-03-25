# Claude Code — Complete Handoff

## Project: Bot Trade Arena

Read ALL files in the /docs/ folder before writing any code. The design system, retention mechanics, scoring logic, and API spec are all documented there.

## Files in this project

### Core Engine (ready to use, tested logic)
- `src/engine/scoring.ts` — Composite scoring system (NOT just win%). Uses P&L + Profit Factor + Sharpe + Risk + Win Rate Bonus with anti-gaming penalties
- `src/engine/match.ts` — Match lifecycle: setup → run → score → ELO update
- `src/engine/matchmaker.ts` — ELO-based matchmaking with expanding search and rematch cooldown

### Database
- `src/models/schema.prisma` — Complete schema: Users, Bots, Matches, Trades, Seasons, Tournaments, Challenges, Clans, Achievements, Leaderboards, MatchSnapshots (for replays), Follow system

### API
- `src/api/routes/index.ts` — 60+ endpoint definitions with WebSocket event specs for both spectators and bots

### SDK
- `sdk/python/bot_trade_arena.py` — Python SDK with BotClient class + 3 starter bots (Momentum, Mean Reversion, Random Baseline)

### Documentation (READ THESE FIRST)
- `docs/SCORING.md` — Why not win%, how composite scoring works, anti-gaming rules, ELO tiers
- `docs/BOT_SDK.md` — How bots connect, trade, and compete
- `docs/UI_UX_RETENTION_BIBLE.md` — **CRITICAL**: Complete design system, color palette, typography, component specs, retention mechanics (streaks, quests, season pass, XP), screen-by-screen UX specs, notification strategy, micro-interactions, frontend tech stack

### Config
- `config/.env.example` — All environment variables
- `package.json` — Dependencies
- `tsconfig.json` — TypeScript config

---

## Implementation Plan

### Phase 1: Backend foundation (Week 1-2)

**Goal: Get two bots trading against each other.**

1. Set up project infrastructure
   ```
   npm install
   Set up PostgreSQL locally
   Set up Redis locally  
   npx prisma generate
   npx prisma migrate dev --name init
   ```

2. Build the Express server (`src/server.ts`)
   - CORS, helmet, rate limiting middleware
   - JWT auth middleware
   - Error handling

3. Implement auth routes
   - POST /api/auth/register (email, username, password → hashed)
   - POST /api/auth/login (→ JWT + refresh token)
   - POST /api/auth/refresh

4. Implement bot CRUD
   - POST /api/bots (create bot, generate API key)
   - GET /api/bots (list my bots)
   - PATCH /api/bots/:id
   - POST /api/bots/:id/regenerate-key

5. Implement the Bot WebSocket server
   - ws://host/bot-ws
   - Auth via API key
   - Forward market ticks
   - Accept trade orders
   - Return order results and state updates

6. Connect Binance WebSocket for market data
   - Connect to wss://stream.binance.com:9443/ws
   - Subscribe to btcusdt@trade, ethusdt@trade, etc.
   - Normalize data and broadcast to match engine

7. Wire it all together
   - Bot connects → authenticates → queues for match
   - Matchmaker pairs two bots
   - Match engine runs → streams data → processes trades → calculates scores
   - Results saved to database

8. Test with starter bots
   - Run Momentum bot vs Mean Reversion bot
   - Verify scoring produces sensible results
   - Verify ELO updates correctly

### Phase 2: Spectator + real-time (Week 2-3)

1. Spectator WebSocket server
   - ws://host/ws (separate from bot WebSocket)
   - Subscribe to live match events
   - Match tick events every second
   - Trade events in real-time
   - Match end results

2. REST endpoints for matches
   - GET /api/matches/live
   - GET /api/matches/:id
   - GET /api/matches/:id/replay (returns MatchSnapshot array)

3. Redis pub/sub
   - Match events published to Redis channels
   - WebSocket servers subscribe to relevant channels
   - Enables horizontal scaling later

4. Sandbox / Practice mode
   - POST /api/sandbox/start (create sandbox session with historical data)
   - Uses same match engine but solo, against a benchmark
   - No ELO changes, no leaderboard impact

### Phase 3: Frontend — The Beautiful Part (Week 3-5)

**READ docs/UI_UX_RETENTION_BIBLE.md before any frontend code.**

Tech stack:
```
Next.js 16 (App Router) + TypeScript
Tailwind CSS v4
shadcn/ui (dark theme customized per the design system)
Framer Motion (animations)
Recharts or Lightweight Charts (TradingView open source)
Zustand (state management)
WebSocket native (real-time)
React Query (API calls)
Plus Jakarta Sans + Inter + JetBrains Mono (fonts)
```

Color palette and typography are defined exactly in the UI bible. Do not deviate.

Build order:
1. **Layout shell** — Dark background, sidebar nav, top bar with streak/XP
2. **Home screen** — Streak display, daily quests, "Find a Match" CTA, live matches, stats cards, upcoming events
3. **Auth pages** — Login/register with progressive onboarding (let them spectate first, then sign up)
4. **Match spectator** — Live match view with bot cards, P&L chart, trade feed, health bar, spectator count, prediction widget
5. **Match results** — Victory/defeat celebration, score breakdown bars, ELO change counter animation, streak maintained, quest completed, achievement unlocked — all on one screen
6. **Bot management** — Bot cards, API key management, career ELO graph, match history
7. **Leaderboards** — Daily/Weekly/Monthly/Season/All-Time tabs, tier filters, pinned self-position, climb tracker
8. **Profile** — Hero area with animated tier badge, achievement showcase, match timeline, bot gallery, season history
9. **Tournaments** — Tournament list, bracket visualization, registration, live tournament view
10. **Challenges** — Daily challenge card, challenge history, leaderboard per challenge

### Phase 4: Retention mechanics (Week 5-6)

1. **Streak system**
   - Track consecutive days with activity in the database
   - Display on home screen, profile, match results
   - Streak freeze (Pro: 1 free/week, Competitor: buy with credits)
   - Streak restore (within 24h for 500 credits)
   - Streak milestones (7, 30, 100, 365) → badges + cosmetics
   - Push notification 2h before midnight if no activity

2. **Daily quests**
   - 3 quests per day, refresh at midnight UTC
   - Quest types: win a match, close N profitable trades, try new symbol, beat personal best, watch a match
   - Completion rewards credits + XP
   - Bonus for completing all 3

3. **XP system**
   - XP earned from: matches (100), wins (+50), quests (50 each), weeklies (200), tournament placement (100-500), challenges (75), spectating (10)
   - Feeds into: Season pass level, lifetime level
   - XP bar visible on home screen and profile

4. **Season pass**
   - 50 levels over 90 days
   - Free track: credits, common badges
   - Premium track (included in Pro plan or $9.99): exclusive frames, bot skins, animated badges
   - Each level requires progressively more XP

5. **Achievements**
   - Seed the database with 50+ achievements
   - Categories: Milestones (first win, 100 wins), Streaks (7-day, 30-day), Skill (beat a Platinum from Silver), Special (trade during a flash crash), Social (join a clan, follow 10 people)
   - Achievement toast notification with animation

6. **ELO decay**
   - After 3 days of inactivity, ELO decays by 5 points/day
   - Notification at day 3: "Your ranking is decaying"
   - Playing 1 match stops decay

### Phase 5: Social + polish (Week 6-8)

1. **Clans** — Create, join, clan leaderboard, clan chat
2. **Follow system** — Follow users, activity feed, friend streaks
3. **Replay viewer** — Frame-by-frame playback from MatchSnapshot data
4. **Share clips** — Auto-generate 15-second highlight from key match moments
5. **Notification system** — In-app + push, max 2/day, value-first
6. **Stripe billing** — Free/Competitor/Pro plans, season pass purchase
7. **Admin panel** — Season management, tournament creation, user moderation

### Phase 6: Launch prep (Week 8-9)

1. Rate limiting per plan tier
2. Bot execution sandboxing (Docker containers)
3. Monitoring + error tracking (Sentry)
4. Database indexing optimization
5. Load testing
6. Deploy (Railway or Fly.io for MVP, AWS for scale)
7. Landing page with spectator demo
8. Discord community setup

---

## Critical design rules

1. **Dark mode only for v1.** The entire platform is dark-first. The color palette in the UI bible is final.
2. **Every number on screen uses JetBrains Mono.** Prices, scores, ELO, P&L, percentages — all monospace.
3. **Composite scoring, never just win%.** The scoring engine in src/engine/scoring.ts is the source of truth.
4. **Dopamine stacking on the results screen.** After every match, show: score, ELO change (animated counter), streak maintained, quest progress, achievement unlocked — ALL visible.
5. **Progressive onboarding.** New users spectate first, then sandbox, then sign up, then first (easy) match. Never front-load a signup form.
6. **Max 2 notifications per day.** Protect the notification channel at all costs.
7. **Free tier always works.** 2 ladder matches/day, 1 tournament/month, sandbox, spectating. No artificial walls on the core loop.
8. **Crypto first.** Binance WebSocket for market data. Free, 24/7, no licensing issues.
9. **Animations are not optional.** Framer Motion on every page transition, card interaction, stat change, and celebration moment. The platform should feel alive.
10. **The home screen answers: "What should I do right now?"** Streak, quests, CTA button, live matches, upcoming events — in that order.
