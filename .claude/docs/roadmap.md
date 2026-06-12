# Roadmap

Phased plan. Each phase has a clear exit criterion. Don't start phase N+1 until N is shippable. For per-phase shipped/deferred details, see `.claude/docs/progress.md`.

---

## Phase 0 — Foundation upgrade ✅

Bring the codebase to current stable Next 15 / React 19 / TS 5 / Tailwind 4. Remove dead deps. Add Vitest. Convert root layout to RSC.

**Exit:** `npm run build` succeeds. App loads. Local play unchanged.

---

## Phase 1 — Project restructure & local refactor ✅

Extract pure engine to `src/game/` (types, rules, deck, seeded shuffle, reducer). 21 Vitest tests. Zustand store. Mobile-friendly file layout (`lib/` → `src/ui/`). `noUncheckedIndexedAccess` enabled.

**Exit:** Engine 21/21 passing. Local play feels identical. No nested setState updaters.

---

## Phase 2 — Supabase + auth + persistence ✅

Local Supabase stack via Docker. Drizzle schema (`users`, `games`, `game_players`, `game_events`, `user_stats`). RLS + `handle_new_user` trigger. Anonymous Supabase Auth with cookie-based session. Name prompt modal. `persistLocalGame` server action + `/profile` page.

**Exit:** Anonymous user finishes a local game and sees it in their history. RLS prevents cross-user reads.

---

## Phase 2.5 — Mobile-first UI rebuild ✅

Pirate design language. `@theme` palette (sea / wood / parchment / treasure / blood / curse / foam). Fonts: Pirata One + Outfit. New primitives `PirateButton`, `PirateCard` (SVG faces with flip), `PirateModal` (bottom-sheet on mobile), `PiratePanel`. Mobile-first rewrites of Home, ChooseGame, Setup, PlayLocal, Profile, NamePromptModal, not-found. Card flip + coin pop animations.

**Exit:** Touch targets ≥ 44px. Tested at 360–414px. No fixed-width legacy layouts on page-level clients.

---

## Phase 3 — Multiplayer rooms ✅

Server-authoritative engine + Supabase Realtime broadcast (REST endpoint with service-role auth — not postgres-changes). Room code generator (4-char from 30-char alphabet, secure random). Server actions: `createRoom`, `joinRoom`, `leaveRoom`, `startOnlineGame`, `drawOnline`, `bankOnline`, `endTurnOnline`. Pages: `/play/new`, `/play/join`, `/play/[code]`. `useGameRoom` realtime hook. `OnlineRoomClient` lobby + play views with optimistic UI for BANK/END_TURN/DRAW. Connection status dot. Re-enabled "Play Online" CTA.

**Exit:** Two devices can finish a multiplayer game end-to-end. (Note: real-device E2E not yet automated.)

---

## Phase 4 — Stats, polish, email upgrade ✅ PARTIAL

Shipped:
- Deck secrecy hardened (dropped `games_member_read` RLS policy).
- `user_stats` populated incrementally on completion (online + local).
- `/profile` reads from `user_stats`. Win-rate suffix. Local/online tag on each game row.
- Anonymous → email account upgrade via `supabase.auth.updateUser` + `markAccountClaimed` server action.

Deferred to later passes:
- Presence + disconnect timers, host-left handling.
- Per-player pirate count + longest-bank stats (engine needs more telemetry).
- Leaderboards (global / weekly).
- Sound effects + richer animations.
- Playwright E2E for multiplayer happy path.

---

## Phase 4.5 — Memory hygiene + DB cleanup ✅

Tab-visibility-aware realtime: `useGameRoom` tears down the channel when the tab is hidden and resubscribes on visible (also fires `router.refresh()` so the RSC re-fetches). Stops background tabs from holding zombie WebSockets overnight.

Daily cron route `/api/cron/cleanup` (Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`) invokes two SQL functions:
- `abandon_stale_games()` — lobbies > 2h → `abandoned`, active games idle > 6h → `abandoned`.
- `prune_old_events()` — deletes events older than 30 days.

---

## Phase 5 — Stretch goals (not started)

Rough priority order:

- **Custom deck variants from setup** — host picks a variant explicitly. Currently hidden / defaults to `even_greedier` per product call.
- **Spectator mode** — friends can watch without playing.
- **Replay** — render past games as a slideshow from `game_events`.
- **Tournaments / brackets** — multi-game series.
- **Real-time chat** in rooms.
- **AI opponents** for solo local play.

---

## What we are NOT doing (explicitly)

- Custom WebSocket server. Supabase Realtime is plenty.
- Mobile native app. PWA is the bar.
- Crypto/NFT anything. This is a card game.
- Server-side rendering of game state mid-match (it's interactive — RSC is for the shell + initial state).
