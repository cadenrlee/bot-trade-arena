# Bot Trade Arena

**The competitive arena for AI trading bots.**

A subscription-based platform where participants build AI trading bots and pit them against each other in real-time and async matches using live market data. Features persistent leaderboards, tiered skill divisions, tournaments, and a full spectator experience.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                     │
│  Spectator Dashboard │ Bot Manager │ Leaderboards │ Auth │
└──────────────┬──────────────────────────┬────────────────┘
               │ REST API                 │ WebSocket
┌──────────────▼──────────────────────────▼────────────────┐
│                   API Gateway (Express)                    │
│  /auth │ /bots │ /matches │ /tournaments │ /leaderboards  │
└──────┬─────────────┬──────────────┬──────────────────────┘
       │             │              │
┌──────▼──────┐ ┌────▼────┐ ┌──────▼──────┐
│  Match      │ │ Market  │ │  Scoring    │
│  Engine     │ │ Data    │ │  Engine     │
│  (core)     │ │ Service │ │             │
└──────┬──────┘ └────┬────┘ └──────┬──────┘
       │             │              │
┌──────▼─────────────▼──────────────▼──────────────────────┐
│              PostgreSQL + TimescaleDB                      │
│  users │ bots │ matches │ trades │ leaderboards │ seasons  │
└──────────────────────────────────────────────────────────┘
       │
┌──────▼──────┐
│   Redis     │
│  Pub/Sub    │
│  Queues     │
│  Caching    │
└─────────────┘
```

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd bot-trade-arena
npm install

# 2. Set up environment
cp config/.env.example .env
# Edit .env with your database credentials and API keys

# 3. Run database migrations
npm run db:migrate

# 4. Seed initial data (tiers, seasons, starter bots)
npm run db:seed

# 5. Start development server
npm run dev

# 6. Run a test match
npm run match:test
```

## Project Structure

```
bot-trade-arena/
├── src/
│   ├── api/              # Express routes and controllers
│   │   ├── routes/       # Route definitions
│   │   ├── middleware/    # Auth, rate limiting, validation
│   │   └── controllers/  # Request handlers
│   ├── engine/           # Core match and scoring engine
│   │   ├── match.ts      # Match lifecycle management
│   │   ├── scoring.ts    # Composite scoring system
│   │   ├── sandbox.ts    # Bot execution sandbox
│   │   └── matchmaker.ts # ELO-based matchmaking
│   ├── models/           # Database models (Prisma)
│   ├── services/         # Business logic
│   │   ├── market.ts     # Market data feeds
│   │   ├── season.ts     # Season management
│   │   ├── tournament.ts # Tournament brackets
│   │   ├── replay.ts     # Match replay system
│   │   └── spectator.ts  # Live spectator feeds
│   ├── utils/            # Helpers and shared utilities
│   └── websocket/        # WebSocket server for live updates
├── sdk/
│   ├── python/           # Python bot SDK + starter bots
│   └── javascript/       # JavaScript bot SDK + starter bots
├── docs/                 # API documentation
├── config/               # Configuration files
├── scripts/              # Database migrations, seed scripts
└── tests/                # Test suites
```

## Key Design Decisions

1. **Composite scoring** — Not just win %. See docs/SCORING.md
2. **Async-first** — Async tournaments alongside live matches
3. **Crypto-first** — 24/7 markets, free data feeds, easier legally
4. **Language-agnostic bots** — Standardized API, any language
5. **Free tier** — 2 ladder matches/day, 1 tournament/month
6. **Seasons** — 3-month cycles with resets and rewards

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **API**: Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Time-series**: TimescaleDB extension for trade data
- **Cache/Queue**: Redis
- **Real-time**: WebSocket (ws library)
- **Market Data**: Binance WebSocket (crypto, free, 24/7)
- **Bot Sandbox**: Docker containers per bot
- **Frontend**: Next.js + React
- **Auth**: JWT + refresh tokens
- **Payments**: Stripe

## Documentation

- [API Reference](docs/API.md)
- [Scoring System](docs/SCORING.md)
- [Bot SDK Guide](docs/BOT_SDK.md)
- [Database Schema](docs/SCHEMA.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
