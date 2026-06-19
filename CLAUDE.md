# Greedy Pirate

A risk-and-reward card game. Players draw from a shuffled deck of gold + pirate cards. Build a streak, bank the loot, or push your luck and lose it all to a pirate. Highest coin total when the deck runs out wins.

## Modes
- **Local** — one device, pass-and-play with 2–10 friends. Pure client-side.
- **Online** — multiplayer rooms across devices, server-authoritative. Players join by 4-char room code.

## Stack (mid-2026)
Next.js 15 · React 19 · TypeScript 5 · Tailwind 4 · Supabase (Postgres + Auth + Realtime) · Drizzle ORM · Zustand · Zod · Vitest

## Architecture in one line
**Pure game engine (`src/game/`) is the single source of truth for rules.** Local mode runs it in the browser. Online mode runs it on the server. Clients never see the deck — only what the server reveals. Realtime sync uses **Supabase Realtime broadcast** (not postgres_changes) — the server publishes the sanitized public state via the REST broadcast endpoint after every action, and clients subscribe to **private**, RLS-gated `room:{CODE}` topics (members only). Broadcasts carry a monotonic version (`game_events.seq`) so clients drop stale/out-of-order payloads.

## Project layout
```
/app                        Next.js routes (App Router, RSC by default)
  /                         home / choose-game / setup
  /play-local               local game (client-only logic)
  /play/new                 RSC creates a room and redirects
  /play/join                client form: enter a room code
  /play/[code]              online lobby + active room (RSC + client)
  /profile                  stats + account upgrade
  /api/cron/cleanup         daily cron route (auth: Bearer CRON_SECRET)
  /api/hello                placeholder route
/src
  /game                     PURE engine: rules, deck, state machine. No React, no DB, no IO.
  /server                   server-only: db client + schema, server actions, supabase clients, realtime broadcaster, stats helpers
  /client                   client-only: zustand stores, hooks, supabase browser client, auth bootstrap, realtime subscriber
  /ui                       shared presentational components (PirateButton/Card/Modal/Panel + legacy primitives)
  /lib                      cross-cutting utils (cn)
/supabase                   Supabase CLI workspace: config.toml + migrations (RLS, triggers, cleanup functions)
/.claude/docs               planning & reference docs (see below)
/scripts                    dev tooling (dev-lan.mjs)
middleware.ts               Next middleware (refreshes Supabase session per request)
vercel.json                 Vercel cron schedule
```

## Where to find things
- **Architecture & multiplayer flow** → `.claude/docs/architecture.md`
- **Pinned versions & rationale** → `.claude/docs/stack.md`
- **Phased build plan** → `.claude/docs/roadmap.md`
- **DB schema + RLS** → `.claude/docs/database.md`
- **Game rules & state machine** → `.claude/docs/game-rules.md`
- **Code conventions** → `.claude/docs/conventions.md`
- **Supabase local + prod setup** → `.claude/docs/supabase-setup.md`
- **Phase status** → `.claude/docs/progress.md`
- **Dev workflow (Linear → branch → PR → merge) + ticket/PR templates** → `.claude/docs/workflow.md`

Sub-directories with their own `CLAUDE.md`: `src/game/`, `src/server/`, `src/client/`.

## Working principles
1. **Pure functions for game logic.** No side effects in `src/game/`. Easy to test, reuse across modes.
2. **Server is authoritative for online play.** The client never knows the deck order. RLS denies direct client SELECT on `games`.
3. **Optimistic UI for the active player.** BANK and END_TURN reduce locally for instant feedback; DRAW shows a loader; server broadcast reconciles.
4. **Mobile-first.** Touch targets ≥ 44px, no hover-only affordances, tested at 360–414px width.
5. **RSC by default.** `'use client'` only where interactivity demands it.
6. **No premature abstraction.** Three similar lines beats a wrong helper.
7. **Type the boundaries strictly.** Zod at every server action; TS internally.
8. **Realtime is fragile.** A backgrounded tab keeps its socket alive (a brief switch must not skip your turn); only a long-idle hidden tab is torn down, preventing zombie WebSockets. Daily cron prunes stale rooms + old events.
