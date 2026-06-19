# Architecture

## Guiding principle

**One game engine, two transports.**

The rules of Greedy Pirate are a pure state machine. We write them once in `src/game/` as plain TypeScript functions with no React, no DB, no network. Both modes call the same `reduce(state, action)` function — local just runs it in the browser, online runs it on the server.

This means:
- Rules cannot diverge between modes.
- The engine is trivially unit-testable (Vitest, no setup).
- Refactoring the UI doesn't risk breaking gameplay.

---

## Layering

```
┌─────────────────────────────────────────────────────────┐
│  UI layer (app/, src/ui/)                               │
│  - React components, routing, styling                   │
│  - Mobile-first PirateButton / PirateCard / PirateModal │
├─────────────────────────────────────────────────────────┤
│  State layer (src/client/stores, hooks)                 │
│  - Zustand store for local mode                         │
│  - useGameRoom (broadcast subscriber) for online mode   │
│  - Optimistic mutators reconciled by server broadcasts  │
├─────────────────────────────────────────────────────────┤
│  Engine (src/game/) — PURE                              │
│  - reduce(state, action) → state                        │
│  - Deck shuffling (seeded), turn advancement, scoring   │
│  - Zero IO. Zero React. Zero DB.                        │
├─────────────────────────────────────────────────────────┤
│  Server (src/server/) — server only                     │
│  - Drizzle + Postgres via Supabase (service-role conn)  │
│  - Server Actions: createRoom, joinRoom, startGame,     │
│    draw/bank/endTurn, setDisplayName                    │
│  - applyAction(): transactional reduce + broadcast      │
│  - realtime/broadcast.ts: POSTs to Supabase Realtime    │
│    REST endpoint with service-role auth                 │
└─────────────────────────────────────────────────────────┘
```

The engine sits at the bottom. Nothing above it can change rules; nothing below it (DB, network) can affect them.

---

## Local mode

Simplest case. Everything in the browser.

```
User taps "Plunder"
  → useGameStore.dispatch({type:'DRAW'})
    → engine.reduce(state, {type:'DRAW'})
      → returns new state
    → store updates
  → React re-renders
```

State lives in the Zustand store. Local games are **ephemeral** — nothing is persisted to the server and they never touch `user_stats`/achievements/voyage history (they use entered names, not the player's identity). Stats are online-only.

---

## Online mode

Authoritative server, optimistic clients, broadcast realtime.

### Topology

```
       Player A (browser)             Player B (browser)
              │                              │
              │  Server Action (mutate)      │
              │ ─────────────────►           │
              │                              │
              │  Supabase Realtime broadcast: "room:ABCD"
              │ ◄────── PublicGameState ─────┤
              │                              │
              ▼                              ▼
        Postgres (games.state JSONB, game_events log)
```

### Why broadcast, not postgres_changes?

Earlier draft used Postgres-changes feeds on `game_events`. That delivery is gated by the realtime websocket's JWT passing RLS — unreliable for anonymously signed-in users in our setup. We switched to **broadcast**: the server POSTs to `${SUPABASE_URL}/realtime/v1/api/broadcast` with the service-role key after each action. Server-side delivery bypasses RLS, lower latency, more predictable.

### Channel security: private channels + RLS

Clients no longer subscribe anonymously. Room topics are **private** Supabase channels: the browser calls `supabase.realtime.setAuth()` and subscribes with `config.private: true`, and RLS on `realtime.messages` (`realtime.is_room_member`) restricts read/send to the host, a seated player, or a spectator of that game. A join-requester who isn't a member yet receives the captain's verdict on their own private `knock:{USER_ID}` topic (`realtime.is_own_knock_topic`), not the room topic. The public matchmaking list (`lobby:public`) stays a public channel. The server still publishes via the service-role REST endpoint (bypasses RLS). (GRE-6)

Before resubscribing (on mount or tab-resume), `useGameRoom` awaits removal of any lingering same-topic channel, so a stale already-subscribed channel can't throw a presence-after-subscribe error or resubscribe without the fresh JWT. (GRE-33)

### Broadcast ordering

Broadcasts are independent HTTP POSTs with `ack:false`, so they can arrive late or out of order. Each game-advancing broadcast carries a monotonic `version` (the `game_events.seq`). The client tracks the highest applied version and **drops any `state` broadcast whose version ≤ the last applied**, so an older payload can't clobber newer state. An optimistic local reduce (BANK/END_TURN) leaves the watermark untouched; the server's confirming broadcast (next seq) reconciles it. On resume, the RSC refresh carries the latest seq and is applied only if newer. (GRE-10)

### Flow: a player draws a card

1. **Client A** taps "Plunder".
2. Optimistic UI: deck count decrements, "Plunderin'…" loader replaces the card. (The draw result isn't predictable client-side — only the server knows the deck.)
3. Client A invokes server action `drawOnline(code)`.
4. **Server** loads game state from Postgres, validates `current_player_id === auth.uid()`, calls `engine.reduce(state, {type:'DRAW'})`.
5. Server writes new state to `games.state`, syncs `game_players.coins`/`isWinner` as needed, appends a `game_events` row, and POSTs the sanitized `PublicGameState` to `room:ABCD` — all inside one transaction.
6. **All clients** (including A) subscribed to `room:ABCD` receive the broadcast and replace their local state. A's optimistic placeholder is overwritten with the real card.

### Why optimistic UI?

The active player should feel zero latency on their own actions. BANK and END_TURN derive entirely from public state, so we reduce them locally. DRAW shows a transient loader since the client can't know the next card. Other players see a ~50–200ms delay (one broadcast hop), which is fine — they're observers on that beat.

### Tab-visibility-aware realtime

`useGameRoom` listens for `visibilitychange`. A hidden tab does **not** tear down immediately — backgrounded ≠ disconnected, and dropping presence on a brief tab-switch surfaced the player as "gone" and got their turn skipped just for glancing away (GRE-54). Instead it keeps the channel and its tracked presence alive and only releases the socket after the tab has stayed hidden `IDLE_UNSUBSCRIBE_MS` (5 min), at which point status → `paused`. On return to visible it cancels that idle timer, resubscribes only if the idle teardown already fired, and calls the `onResume` callback the page wires to `router.refresh()` — re-running the RSC initial fetch so the player reconciles to the latest state.

A genuine tab close / process kill / network drop closes the WebSocket immediately regardless, which fires presence `leave` on the server side — so a real departure is still detected promptly, while a glance away is not. This keeps short tab-switches seamless while still preventing abandoned tabs from holding zombie WebSockets overnight.

---

## Room lifecycle

1. **Create** — `/play/new` (RSC) calls `createRoom()`. Server generates a 4-char code from a 30-char alphabet (no `0/O/1/I/L`), inserts a `games` row with `status='lobby'`, seats the host via `applyAction({type:'PLAYER_JOIN'})`, and redirects to `/play/{code}`.
2. **Join** — `/play/join` (form) or `/play/{code}` (auto-gate). `joinRoom({code})` validates lobby + capacity, dispatches `PLAYER_JOIN`, inserts the seat row.
3. **Start** — Host taps "Hoist the Colors". `startOnlineGame({code})` validates `host_id === auth.uid()`, dispatches `START_GAME` with a `crypto.randomUUID()` seed.
4. **Play** — Turn validation via `current_player_id === auth.uid()`. DRAW / BANK / END_TURN.
5. **End** — When deck empties, engine transitions to `'complete'`. `applyAction` detects the transition and bumps `user_stats` for every seated user.
6. **Cleanup** — Stale lobbies (>2h) and idle active games (>6h) get auto-abandoned by the daily cron (`/api/cron/cleanup`).

---

## Memory hygiene

Long-running tabs + accumulating DB rows = compounding bloat. Mitigations:

- **Tab visibility** — already covered above. Tabs hidden longer than `IDLE_UNSUBSCRIBE_MS` (5 min) drop their WebSocket; a real close drops it at once.
- **Daily cron** — Vercel Cron hits `/api/cron/cleanup` once daily (Hobby tier cap). Calls two SQL functions:
  - `abandon_stale_games()`: lobbies > 2h and active games with no events > 6h → `abandoned`.
  - `prune_old_events()`: deletes `game_events` rows older than 30 days.
- **Auth on the cron route** — `Authorization: Bearer ${CRON_SECRET}` required. Vercel injects this automatically; locally use `CRON_SECRET=dev-cron-secret` and hit it manually.

---

## Security model

| Threat | Mitigation |
|---|---|
| Player peeks at deck order | Deck stored server-side only. RLS on `games` denies all SELECT to anon/authenticated — only Drizzle's service-role connection reads it. Broadcast payloads carry the sanitized `PublicGameState` (no `deck` field). |
| Player draws on someone else's turn | Server validates `current_player_id === auth.uid()` before calling the engine. Engine itself is pure — server is the only enforcement point. |
| Player fakes a high-value card | Server is the only writer to `games.state`. Client deltas are received-only. Server-side `reduce` validates every state transition. |
| Player subscribes to a foreign room or forges broadcasts | Room channels are **private**; RLS on `realtime.messages` limits subscribe/send to the host, a seated player, or a spectator of that game. Server publishes via service-role. (GRE-6) |
| Player spams the cron route | `CRON_SECRET` Bearer check returns `401` for unauthorized callers; compared in constant time (`timingSafeEqual`). (GRE-8) |
| Open redirect via auth-callback `next` | `next` is validated to a same-origin path (rejects `//host`, `/\host`, absolute URLs) before redirect. (GRE-7) |
| Brute-force join by guessing codes | 4 chars × 30-char alphabet ≈ 810k combos. Rate limit on `joinRoom` can be added if abuse appears. |
| Multiple anonymous accounts evading caps | Acceptable for now — accounts are free anyway. Add IP-based throttle if abuse appears. |

---

## Anonymous → email upgrade path

Supabase Auth supports anonymous sign-in natively. Flow:

1. First visit → `AuthBootstrap` calls `supabase.auth.signInAnonymously()`. Trigger `handle_new_user` creates `public.users` + `public.user_stats` rows.
2. Player picks a display name → `setDisplayName` server action writes `users.display_name`.
3. Plays games, accumulates stats tied to anon `user_id`.
4. (Later) Player visits `/profile` → "Claim my account" card → browser calls `supabase.auth.updateUser({email, password})`. Anon JWT converts to permanent. Server action `markAccountClaimed` mirrors `is_anonymous=false` into `public.users`. **All stats and history carry over** because the underlying `user_id` doesn't change.

No signup wall. No lost data.

---

## Where state lives

| State | Local mode | Online mode |
|---|---|---|
| Player list | Zustand store | Postgres `game_players` |
| Deck | Zustand store | Postgres `games.state.deck` (service-role only) |
| Current card | Zustand store | `games.state.currentCard` + broadcast |
| Streak | Zustand store | `games.state.currentStreak` + broadcast |
| Bank totals | Zustand store | `game_players.coins` + broadcast |
| Turn index | Zustand store | `games.state.turnIndex` + `games.current_player_id` |
| UI flags (modal open, draw-pending) | React state | React state |
| Realtime connection status | n/a | `useGameRoom` hook |

---

## What goes on Vercel vs Supabase

- **Vercel**: Next.js app (UI, RSC, Server Actions, middleware, Cron route).
- **Supabase**: Postgres, Auth, Realtime broker, Storage (unused so far).

No custom Node WebSocket server. No Docker in production. Both free tiers cover foreseeable usage. Vercel Hobby Cron is once-daily — fine for our cleanup cadence.

---

## Deferred / known gaps

- Per-player pirate count and longest-bank stats are still not surfaced (GRE-26).
- Leaderboards / daily challenge / return reasons (GRE-27).
- Playwright + server-action/realtime-reducer test coverage (GRE-16).
- Continuation-finalize atomicity + unified seq generation (GRE-11).

Resolved since this list was first written: presence online/offline tracking with grace timers, host-left auto-promote (cron host migration), and private realtime channels (GRE-6).
