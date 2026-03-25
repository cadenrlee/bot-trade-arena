# Claude Code Handoff Guide

## What's ready

This project contains a complete specification and core implementation for Bot Trade Arena. Here's what's been built and what needs to be implemented next.

### Built (ready to use)

| File | What it is |
|------|-----------|
| `README.md` | Full project overview, architecture diagram, quick start |
| `src/models/schema.prisma` | Complete database schema (20+ models) with all relations |
| `src/engine/scoring.ts` | Composite scoring engine with anti-gaming rules |
| `src/engine/match.ts` | Match engine — full lifecycle management |
| `src/engine/matchmaker.ts` | ELO-based matchmaking system |
| `src/api/routes/index.ts` | Complete API route specification (60+ endpoints) |
| `sdk/python/bot_trade_arena.py` | Python SDK + 3 starter bots |
| `docs/SCORING.md` | Scoring system documentation |
| `docs/BOT_SDK.md` | Bot SDK documentation |
| `config/.env.example` | Environment configuration template |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |

### Supplementary files (in /mnt/user-data/outputs/)

| File | What it is |
|------|-----------|
| `AI_Trading_Bot_Arena_Roadmap.md` | Full business roadmap, competitive analysis, go-to-market |
| `BotTradeArena_Honest_Analysis.md` | Honest assessment — strengths, risks, retention features |
| `BotTradeArena_PitchDeck.pptx` | 9-slide pitch deck |

## Implementation priority for Claude Code

### Phase 1: Get the core running (Week 1-2)

```
1. npm install
2. Set up PostgreSQL + Redis locally
3. npx prisma migrate dev (create tables from schema)
4. Implement the Express server (src/server.ts)
5. Implement auth routes (register, login, JWT)
6. Implement bot CRUD routes
7. Wire up the match engine with WebSocket server
8. Connect Binance WebSocket for live crypto prices
9. Get a test match running between two starter bots
```

Key commands to give Claude Code:

```
"Set up the Express server with all middleware (cors, auth, rate limiting).
Use the schema in src/models/schema.prisma and the routes defined in 
src/api/routes/index.ts. Start with auth, bots, and matches endpoints.
The match engine is in src/engine/match.ts and scoring in src/engine/scoring.ts."
```

### Phase 2: Matchmaking + WebSocket (Week 2-3)

```
1. Implement WebSocket server for spectators
2. Implement bot WebSocket server (separate from spectator)
3. Wire matchmaker.ts into the queue system
4. Implement match lifecycle: queue -> match -> score -> update ELO
5. Build the sandbox/practice mode
6. Add Redis pub/sub for real-time events across server instances
```

### Phase 3: Seasons, tournaments, challenges (Week 3-4)

```
1. Implement season management (create, activate, reset)
2. Implement tournament brackets (single/double elim)
3. Implement daily challenges
4. Implement leaderboard aggregation (daily/weekly/monthly/season)
5. Add achievement system
```

### Phase 4: Frontend (Week 4-6)

```
1. Set up Next.js frontend
2. Auth pages (login, register, profile)
3. Bot management dashboard
4. Matchmaking queue UI
5. Live spectator dashboard (reuse the prototype design)
6. Leaderboard pages
7. Tournament brackets
8. Bot profile pages
9. Replay viewer
10. Subscription/billing with Stripe
```

### Phase 5: Polish + launch prep (Week 6-8)

```
1. Stripe integration for subscriptions
2. Free tier rate limiting (2 matches/day)
3. Clan system
4. Follow/social features
5. Email notifications (match results, tournament starts)
6. Admin panel
7. Deploy to production (Railway, Fly.io, or AWS)
```

## Key design decisions to maintain

1. **Scoring**: Always use the composite score, never just win%. See docs/SCORING.md.
2. **Crypto-first**: Start with Binance WebSocket data (free, 24/7, no licensing).
3. **Free tier**: Always keep a free path to competition (2 matches/day).
4. **Async mode**: Every tournament should support async submission alongside live.
5. **Seasons**: 3-month cycles with soft ELO reset.
6. **Sandbox**: Must exist before ranked play launches.
7. **Starter bots**: Ship 3+ working bots in the SDK from day 1.

## Architecture notes for Claude Code

- **Database**: Prisma ORM handles migrations and type safety. Run `npx prisma generate` after any schema changes.
- **Real-time**: Use Redis pub/sub to broadcast match events. WebSocket server subscribes to Redis channels.
- **Bot isolation**: In production, run each bot in a Docker container. For dev, run in-process.
- **Market data**: The Binance WebSocket streams are free and don't require authentication for public market data. Connect to `wss://stream.binance.com:9443/ws/btcusdt@trade` for real-time trades.
- **Scoring**: The scoring engine is pure functions with no side effects — easy to test and modify.
- **Match snapshots**: Store a snapshot every 5 seconds for the replay system. These go into the MatchSnapshot table.
