# Bot Trade Arena — UI/UX & Retention Bible

## Design Philosophy

Bot Trade Arena should feel like what happens when Robinhood's elegance meets Valorant's competitive energy meets Duolingo's addictiveness. Dark-first. Data-rich but not cluttered. Every screen should make you feel like you're inside a command center watching a high-stakes battle unfold.

**Design pillars:**
1. **Cinematic data** — Charts and numbers should feel alive, not static. Motion, glow, pulse.
2. **Competitive identity** — Every element reinforces "you are a competitor." Ranks, badges, streaks.
3. **Progressive disclosure** — Never overwhelm. Reveal complexity as users earn it.
4. **Dopamine architecture** — Every session delivers at least one small win.

---

## Visual Design System

### Color Palette

```
Primary background:     #0A0E1A (deep space navy)
Secondary background:   #111827 (card surfaces)
Tertiary background:    #1E293B (elevated cards, modals)
Border default:         rgba(255, 255, 255, 0.06)
Border hover:           rgba(255, 255, 255, 0.12)

Text primary:           #F1F5F9 (high contrast white)
Text secondary:         #94A3B8 (muted descriptions)
Text tertiary:          #475569 (hints, timestamps)

Accent primary:         #6366F1 (indigo — your bot, primary actions)
Accent secondary:       #10B981 (emerald — opponent, success, profit)
Accent danger:          #EF4444 (red — loss, errors, live badge)
Accent warning:         #F59E0B (amber — warnings, Gold tier)
Accent purple:          #8B5CF6 (purple — Platinum tier, premium)

Tier colors:
  Bronze:    #CD7F32
  Silver:    #C0C0C0
  Gold:      #FFD700
  Platinum:  #A78BFA (purple glow)
  Diamond:   #60A5FA (ice blue glow)

Chart colors:
  Your bot:     #6366F1 (indigo)
  Opponent:     #10B981 (emerald)
  Profit:       #22C55E (green)
  Loss:         #EF4444 (red)
  Neutral:      #64748B (slate)
```

### Typography

```
Display / Headers:   "Plus Jakarta Sans" (bold, geometric, modern)
Body text:           "Inter" (clean, highly legible at small sizes)
Monospace / Numbers: "JetBrains Mono" (for prices, scores, code)

Scale:
  Hero title:     48px / 700 weight / -1.5px tracking
  Page title:     28px / 700 weight / -0.5px tracking
  Section title:  20px / 600 weight
  Card title:     16px / 600 weight
  Body:           14px / 400 weight / 1.6 line height
  Caption:        12px / 400 weight
  Mono numbers:   16px / 500 weight (JetBrains Mono)
  Big stat:       32px / 700 weight (JetBrains Mono)
```

### Component Library

**Cards:** Dark glass effect. Background: rgba(17, 24, 39, 0.8). Border: 1px solid rgba(255, 255, 255, 0.06). Border-radius: 16px. Subtle backdrop-blur on hover.

**Buttons:**
- Primary: Indigo gradient (6366F1 → 8B5CF6), white text, 12px radius, subtle glow on hover
- Secondary: Transparent bg, 1px border rgba(255,255,255,0.12), white text
- Danger: Red gradient for destructive actions
- Ghost: No bg, no border, text + icon only

**Stat cards:** Muted label (12px, secondary text) above, big mono number (24-32px) below. Subtle background surface. Use color to indicate positive/negative.

**Live indicators:** Small pulsing red dot with CSS animation for live matches. Green dot for connected bots. Gray for inactive.

**Tier badges:** Each tier has its own glow effect. Bronze = warm glow. Gold = golden shimmer. Diamond = ice-blue pulse. These should feel like rank insignias, not generic labels.

**Charts:** Dark background, no grid lines. Smooth curved lines (tension: 0.4). Area fill with 8% opacity. Crosshair on hover with tooltip. Use the bot's accent color for their line.

**Animations:**
- Page transitions: 200ms fade + 10px slide up
- Card hover: 150ms scale(1.01) + border glow
- Number changes: Counter animation (count up/down to new value)
- New trade: Slide in from right with 300ms ease-out
- Win/loss flash: Brief green/red background pulse on trade close
- Achievement unlock: Full-screen overlay with particle burst, 2-second celebration

---

## Retention Mechanics (stolen from the best)

### 1. STREAKS (from Duolingo)

**Arena Streak:** Track consecutive days with at least one match or challenge completed.

- Display prominently on home screen with fire icon
- Streak counter uses JetBrains Mono, large, with subtle glow at milestones
- **Streak freeze:** Pro subscribers get 1 free freeze per week. Competitor plan can buy with earned credits.
- **Streak wager:** At day 1, offer "Complete 7 days for 2x credits." This increases day-7 retention by 14% (Duolingo's data).
- **Streak milestones:** 7 days, 30 days, 100 days, 365 days. Each unlocks a badge and exclusive cosmetic (profile frame, bot skin).
- **Streak society:** Users with 30+ day streaks get access to an exclusive Discord channel / community area.

Implementation:
```
Streak displayed: Home screen top bar, profile page, match results
Streak reminder: Push notification 2 hours before midnight if no activity
Streak break: Show "Restore streak for 500 credits" within 24 hours
```

### 2. DAILY QUESTS (from Fortnite / Clash Royale)

Three daily quests that refresh every 24 hours. Completing all three earns a bonus reward.

Example quests:
- "Win a match" — 50 credits
- "Close 10 profitable trades across matches" — 30 credits
- "Try a new symbol you haven't traded before" — 20 credits
- "Beat your personal best score" — 40 credits
- "Watch a featured match" — 15 credits
- Bonus for completing all 3: 50 extra credits + XP multiplier

Visual: Three circular progress rings on the home screen. Each fills as you progress. Satisfying completion animation when all three are done.

### 3. WEEKLY CHALLENGES (from Apex Legends)

Harder challenges that refresh weekly. These push users to try new things:
- "Win 5 matches in a row"
- "Place top 3 in a tournament"
- "Achieve a score above 700 in a single match"
- "Win with a profit factor above 2.0"

Reward: Weekly challenge crate with randomized cosmetics or credits.

### 4. SEASON PASS / BATTLE PASS (from Fortnite)

A 90-day season pass with 50 levels. Earn XP from matches, challenges, and streaks. Each level unlocks a reward.

Free track: Basic rewards (credits, common badges)
Premium track ($9.99 or included in Pro plan): Exclusive profile frames, bot skins, animated tier badges, emotes for chat

This gives people a reason to play every single day for 3 months straight.

### 5. XP SYSTEM (from every game)

Everything earns XP:
- Complete a match: 100 XP
- Win a match: +50 XP bonus
- Daily quest completion: 50 XP each
- Weekly challenge: 200 XP
- Tournament placement: 100-500 XP based on position
- Challenge mode completion: 75 XP
- Watching a match: 10 XP (spectator engagement)

XP feeds into: Season pass level, lifetime level (separate from ELO), and weekly XP leaderboard.

### 6. LOSS AVERSION MECHANICS

**"Almost" notifications:** If someone's bot is close to ranking up (e.g., 50 ELO from Gold), send a notification: "You're 2 wins away from Gold tier. Queue up?"

**Decay warning:** If a user hasn't played in 3 days, show their ELO starting to decay slightly. "Your ranking is decaying. Play a match to maintain your position." (Borrowed from League of Legends)

**Streak protection:** Make the streak freeze feel premium and limited. Users will play to avoid needing it.

### 7. SOCIAL HOOKS

**Friend streaks (from Snapchat/Duolingo):** Co-streaks with friends. Both need to play on the same day to maintain it.

**Bot of the week:** Community-voted featured bot. Gets a special badge and spotlight on the home page.

**Replay sharing:** One-tap share a match highlight clip to Twitter/Discord/Reddit. Auto-generates a 15-second clip of the key moment.

**@mentions in match chat:** Tag friends to watch your live match. "Come watch me take on this Platinum bot!"

### 8. PROGRESSIVE ONBOARDING (from Duolingo)

**Do NOT** show the sign-up page first. Let them:
1. Watch a featured live match (30 seconds of spectating)
2. Try the sandbox with a starter bot (immediate win)
3. THEN ask them to create an account to "save your progress"
4. First match should be against an intentionally beatable bot (confidence builder)
5. Win → celebration → streak starts → now they're hooked

**Feature unlock cadence:**
- Day 1: Ladder matches, sandbox
- Day 3: Challenges mode unlocks
- Day 7: Tournaments unlock + clan invite
- Day 14: Advanced analytics unlock
- Day 30: Replay tools unlock

This creates a drip of "new stuff" that keeps the first month exciting.

---

## Screen-by-Screen UX Specifications

### Home Screen (The Hub)

This is the most important screen. It should answer: "What should I do right now?"

```
┌─────────────────────────────────────────────┐
│  [Logo]  Bot Trade Arena     [🔔] [Avatar]  │
│─────────────────────────────────────────────│
│                                              │
│  🔥 12-day streak          Season 1: Week 4  │
│  ━━━━━━━━━━━━━ 847 XP to Level 12           │
│                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Quest 1 │ │ Quest 2 │ │ Quest 3 │       │
│  │  ○ 1/1  │ │  ◔ 3/10 │ │  ○ 0/1  │       │
│  └─────────┘ └─────────┘ └─────────┘       │
│                                              │
│  ╔══════════════════════════════════════╗    │
│  ║  [FIND A MATCH]  ← Big CTA button   ║    │
│  ╚══════════════════════════════════════╝    │
│                                              │
│  📺 LIVE NOW (3 matches)                     │
│  ┌──────────────────────────────────────┐   │
│  │ DeepAlpha vs MomentumX  │ GOLD │ 👁 47│   │
│  │ Score: 412 — 389  │  2:34 remaining  │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  🏆 YOUR STATS                               │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐              │
│  │Gold│ │ 67%│ │ 142│ │#234│              │
│  │Tier│ │WinR│ │Wins│ │Rank│              │
│  └────┘ └────┘ └────┘ └────┘              │
│                                              │
│  📅 UPCOMING                                 │
│  │ Weekly Tournament #13 │ Starts in 4h    │ │
│  │ Daily Challenge │ "Survive the Dip"     │ │
│                                              │
│  [Nav: Home | Matches | Bots | Rankings]     │
└─────────────────────────────────────────────┘
```

Key UX decisions:
- Streak and XP bar are ALWAYS visible — loss aversion + progress
- Daily quests front and center — gives immediate actionable goals
- Big "Find a Match" CTA — removes friction from the core loop
- Live matches shown as social proof — "people are playing right now"
- Upcoming events create anticipation — "come back in 4 hours"

### Match Spectator Screen

Already designed in the prototype, but additions:
- **Health bar style indicator** at the top: visual tug-of-war between two bots
- **"Key moment" badges** that pop up when a pivotal trade happens
- **Live spectator count** (social proof)
- **Quick reactions** (thumbs up, fire, skull emojis) that float up on screen
- **Prediction widget**: "Who will win? Tap to predict" (earn XP for correct predictions)
- **Commentator mode toggle**: AI-generated play-by-play in a sidebar

### Match Results Screen

This screen needs to be a **celebration moment**, not just a stat dump.

```
┌─────────────────────────────────────────────┐
│                                              │
│            🏆 VICTORY! 🏆                    │
│     (or animated "DEFEAT" with encouragement)│
│                                              │
│   Your Bot          vs        Opponent       │
│   ████████░░        ←→        ░░████████     │
│   Score: 647                   Score: 521    │
│                                              │
│   ┌─────────────────────────────────────┐   │
│   │ 📊 Score Breakdown                  │   │
│   │                                     │   │
│   │ P&L Score:      ████████░░  198/250 │   │
│   │ Profit Factor:  ███████░░░  175/250 │   │
│   │ Sharpe Ratio:   ██████░░░░  152/250 │   │
│   │ Risk Mgmt:      █████████░  135/150 │   │
│   │ Win Rate Bonus: ███░░░░░░░   37/100 │   │
│   │ Penalties:      ░░░░░░░░░░    0     │   │
│   └─────────────────────────────────────┘   │
│                                              │
│   ELO: 1342 → 1367 (+25) ⬆                  │
│   🔥 Streak: 12 days (maintained!)           │
│   ✅ Quest completed: "Win a match"          │
│   🎖 Achievement: "5-win streak!" [NEW]      │
│                                              │
│   [Watch Replay]  [Share]  [Play Again]      │
│                                              │
└─────────────────────────────────────────────┘
```

Key: Stack all the dopamine hits on one screen. ELO change, streak maintained, quest completed, achievement unlocked — show them ALL at once.

### Bot Management Screen

Where users manage their bots. Should feel like a garage/workshop.

- Bot card with avatar, name, language badge, and lifetime stats
- "Career graph" showing ELO over time
- Quick actions: Edit, Connect, View Matches, Copy API Key
- "Upgrade Lab" section showing bot improvement suggestions based on match data

### Rankings / Leaderboard Screen

- Tab navigation: Daily | Weekly | Monthly | Season | All-Time
- Your position is always highlighted and pinned at the bottom if you're not in the visible range
- Tier filter buttons across the top
- Each entry shows: Rank, Username, Bot Name, Tier Badge, ELO, Win Rate, Matches
- Clan leaderboard as a separate tab
- "Climb tracker": Shows how many positions you moved today (+12 ▲)

### Profile Screen

- Large hero area with tier badge (animated glow for Platinum+), streak count, season level
- Achievement showcase (user picks 3-5 to display)
- Match history timeline
- Bot gallery (their fleet of bots)
- Season history (past season placements)
- Follow/Follower counts
- Clan badge

---

## Notification Strategy (from Duolingo's playbook)

**Rule: Protect the notification channel.** Never spam. Every notification must deliver value.

| Trigger | Timing | Message Style |
|---------|--------|---------------|
| Streak about to break | 2 hours before midnight | "Your 12-day streak is on the line! Quick match?" |
| Match result (if played async) | When results ready | "Your bot won! Score: 647. You gained 25 ELO." |
| Tournament starting | 1 hour before | "Weekly Tournament #13 starts in 1 hour. Don't miss it." |
| Rank milestone | Immediately | "You just hit Gold tier! 🏆" |
| Friend activity | When friend plays | "@quantwizard just hit a 20-win streak. Can you beat it?" |
| Decay warning | After 3 days inactive | "Your ELO is decaying. One match keeps your rank safe." |
| New season | Season start day | "Season 2: 'Volatility Wars' is live. Fresh rankings await." |

**Never send more than 2 notifications per day.** Duolingo found that oversending causes notification opt-out, which permanently kills the reactivation channel.

---

## Micro-interactions That Matter

1. **Trade pulse:** When a trade executes during a live match, the affected stat card briefly pulses green (win) or red (loss)
2. **ELO counter:** On the results screen, the ELO number physically counts up/down to its new value (not a jump cut)
3. **Streak fire:** The streak flame icon grows slightly larger at milestone numbers (7, 30, 100)
4. **Tier promotion:** Full-screen animation when you tier up. Confetti, glow, new tier badge animates in
5. **Match found:** When matchmaking finds an opponent, a dramatic "VS" screen with both bot names and a countdown
6. **Achievement toast:** Slides in from the bottom with a satisfying sound effect and particle burst
7. **Leaderboard climb:** Your row in the leaderboard briefly glows when you move up
8. **Daily quest completion:** Each quest ring fills with a satisfying circular progress animation

---

## Tech Stack for Frontend

```
Framework:      Next.js 16 (App Router)
Styling:        Tailwind CSS v4 + custom design tokens
Components:     shadcn/ui (customized to match dark theme)
Charts:         Recharts or Lightweight Charts (TradingView's open source)
Animations:     Framer Motion
Real-time:      WebSocket (native) + React Query for API
State:          Zustand (lightweight, perfect for real-time data)
Auth:           NextAuth.js
Icons:          Lucide React
Fonts:          Plus Jakarta Sans + Inter + JetBrains Mono (Google Fonts)
```
