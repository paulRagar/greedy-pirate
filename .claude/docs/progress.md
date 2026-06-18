# Progress

Tracks where the overhaul stands. Update at the end of each phase.

## Phase 0 — Foundation upgrade ✅ COMPLETE (2026-06-10)

**Shipped**
- Next.js 13.4 → 15.5
- React 18.2 → 19
- TypeScript 4.9 → 5.6 (target ES2022, `moduleResolution: bundler`)
- Tailwind 3 → 4 (PostCSS plugin, CSS `@theme`, `@reference` directive in CSS modules)
- ESLint 8 → 9, added Vitest 2.1
- Removed `ably` (unused; switching to Supabase Realtime)
- Removed `experimental.appDir`
- Root `app/layout.tsx` converted from `'use client'` to Server Component
- `src/ui/theme/ThemeProvider.tsx` extracted as client island
- Added TS path aliases for upcoming `src/` layout: `@/game`, `@/server`, `@/client`, `@/ui`, `@/lib`
- Renamed package: `nut-nut-squirrel` → `greedy-pirate`
- `metadataBase` added for OG image resolution
- Fixed `not-found.tsx` link (`/home` → `/`)
- Fixed legacy type errors surfaced by stricter TS (`ButtonIcon` import path, `Icon` JSX namespace, `play-local/page.tsx` async searchParams for Next 15)
- `Checkbox.module.css` got `@reference` directive (Tailwind v4 requirement)
- Vitest smoke test passing
- `npm run typecheck`, `npm run build`, `npm run test:run`, `npm run dev` all green

**Deferred to Phase 1**
- `noUncheckedIndexedAccess` in tsconfig — too noisy against legacy `PlayLocalClient`, will re-enable after refactor.
- Delete dead `app/page.module.css` (unused create-next-app leftover).
- 7 npm vulnerabilities (6 moderate, 1 critical) from `@svgr/cli` and `ts-node` transitives — likely resolved when SVGR pipeline is reworked or pinned.

## Phase 1 — Project restructure & local refactor ✅ COMPLETE (2026-06-10)

**Shipped**
- Pure engine in `src/game/`: `types.ts`, `rules.ts`, `deck.ts`, `shuffle.ts` (mulberry32 seeded RNG + Fisher-Yates), `engine.ts` (`reduce(state, action)`), `index.ts` barrel.
- 21 Vitest tests covering joins/leaves, start preconditions, deterministic shuffle, draw gold/pirate, bank, end-turn, game completion, winner selection, action rejection paths, and reducer purity.
- `src/client/stores/gameStore.ts` — Zustand 5 store wrapping the engine.
- Refactored `PlayLocalClient.tsx`: dispatches engine actions through the store. Broken into small subcomponents (StatusBanner, CardDisplay, StreakSummary, PlayerList). No nested `setState` updaters. ~150 fewer lines.
- `lib/components/*` → `src/ui/*`. `lib/types/{button,colors,icon}.ts` → `src/ui/types/`. `lib/` directory deleted.
- Dropped legacy `@/components/*` and `@/types/*` tsconfig aliases. Aliases now: `@/game`, `@/server`, `@/client`, `@/ui`, `@/lib`.
- Re-enabled `noUncheckedIndexedAccess` — strict TS clean across the whole codebase.
- Deleted dead `app/page.module.css`. Deleted dead `lib/types/deck.ts`.
- Updated `npm run svg` SVGR target paths to `src/ui/icons` and `src/ui/types/icon.ts`.
- Added scoped `src/game/CLAUDE.md` (engine contract) and `src/client/CLAUDE.md` (client-only rules).
- `app/play-local/page.tsx` now accepts both `?variant=greedy|even_greedier|super_greedy` (new) and `?evenGreedier=true` (legacy alias for `super_greedy`).
- `even_greedier` variant is now wired up (was unreferenced in legacy code).

**Verified**
- `npm run typecheck` clean with strict + `noUncheckedIndexedAccess`.
- `npm run test:run` — 21/21 passing.
- `npm run build` — clean.
- `npm run dev` — `/`, `/choose-game`, `/setup`, `/play-local` all return 200.

**Known caveats**
- Browser feature-level smoke (clicking through a full game) hasn't been done in this session. Recommend a manual playthrough before declaring done-done.
- `super_greedy` deck total is 98 cards (legacy was advertised as 100 in older notes — re-counted from source). Doc updated.
- 7 npm vulnerabilities (6 moderate, 1 critical) still present from `@svgr/cli` + `ts-node` transitives. Defer until SVGR rework.

## Phase 2 — Supabase + Auth + Persistence ✅ COMPLETE (2026-06-10)

**Shipped**
- Supabase CLI installed (`brew install supabase/tap/supabase`, v2.105.0).
- `supabase init` + `supabase start` — local Docker stack running (Postgres, Auth, Realtime, Studio).
- Anonymous sign-ins enabled in `supabase/config.toml`.
- Drizzle ORM 0.45 wired up. `postgres.js` driver. `drizzle.config.ts` reads `.env.local` then `.env`.
- `src/server/db/schema.ts` — `users`, `games`, `game_players`, `game_events`, `user_stats` with FK to `auth.users`, partial unique index on active room codes, indexes on FK columns. All UUIDs use `gen_random_uuid()` (cryptographically secure).
- First Drizzle migration generated + applied (`0000_orange_khan.sql`). Manual edit: removed spurious `CREATE TABLE auth.users` (managed by Supabase Auth, not us).
- `supabase/migrations/20260610180000_rls_and_triggers.sql` — `handle_new_user()` trigger auto-creates `public.users` + `public.user_stats` rows on `auth.users` insert. 6 RLS policies scoped to self / co-members.
- Supabase clients: `getSupabaseServer()` (cookie-aware, RLS-respecting), `supabaseAdmin` (service-role), `getSupabaseBrowser()`.
- Next middleware refreshes Supabase session on every request.
- `AuthBootstrap` + `useCurrentUser` + `NamePromptModal` — anonymous sign-in on first visit, name capture with `setDisplayName` server action (Zod-validated).
- `persistLocalGame` server action — saves completed local games (game + game_players + GAME_ENDED event) in a transaction. Fires from `PlayLocalClient` on completion, idempotent via `useRef` key.
- `/profile` page — RSC, lists hosted games + win count + recent games. Mobile-first layout (single column, ≥44px touch targets).
- "My Logbook" link added to home.
- `.env.example` (committed) + `.env.local` (committed for shared local dev defaults — these aren't secret in dev context).
- npm scripts: `db:generate`, `db:migrate`, `db:push`, `db:studio`, `supabase:start`, `supabase:stop`, `supabase:reset`.
- `.claude/docs/supabase-setup.md` — full walkthrough for local dev workflow and prod project creation.
- Scoped CLAUDE.md files added to `src/server/` and `src/client/`.

**Verified**
- `npm run typecheck` clean.
- `npm run test:run` — 21/21 engine tests still passing.
- `npm run build` clean (8 routes including `/profile`).
- `npm run dev` — `/`, `/choose-game`, `/setup`, `/play-local` 200; `/profile` 307 redirect (expected when unauthenticated curl).
- Database verified via `docker exec ... psql`: 5 public tables, `on_auth_user_created` trigger active, 6 RLS policies in place.

**Known caveats**
- Manual click-through smoke (anon sign-in → name prompt → finish a game → see it on /profile) hasn't been done this session. Recommend a full playthrough before merging.
- Edge-runtime warning in build output: `@supabase/supabase-js` touches `process.version`. Harmless because we use the Node runtime, but middleware uses Edge. Will revisit if middleware path needs Supabase calls beyond `getUser`.
- Stat tracking is approximate: `games_won` counts where any seat with the host's display name is the winner. Per-seat real users wait for multiplayer (Phase 3).
- `user_stats` table is created but not yet populated. Profile derives stats from `games` + `game_players` directly. Backfill once multiplayer per-seat user IDs land.

See `.claude/docs/roadmap.md`.

## Phase 2.5 — Mobile-first UI rebuild ✅ COMPLETE (2026-06-10)

**Shipped**
- New pirate design language. Tailwind v4 `@theme` tokens for sea / wood / parchment / treasure / blood / curse / foam palettes. Display font Pirata One, body Outfit.
- Layout overhaul: full-bleed ocean gradient background, max-width 3xl container, `safe-top`/`safe-bottom` insets, `viewport-fit: cover`, `theme-color: #051426`, Apple PWA capable meta.
- Card flip animation (CSS) and coin-pop + pirate-shake keyframes.
- New primitives in `src/ui/`:
  - `pirate-button/PirateButton` — 5 variants (treasure / sea / wood / ghost / danger), 3 sizes (sm/md/lg) with ≥44px / 52px / 64px touch targets.
  - `pirate-panel/PiratePanel` — sea / wood / parchment surface variants with subtle texture.
  - `pirate-card/PirateCard` — inline SVG card faces (skull on back, coin on gold, pirate badge on pirate). Auto-flips when a card is drawn.
  - `pirate-modal/PirateModal` — mobile bottom-sheet, desktop centered. Escape-to-close, body-scroll lock.
- `src/lib/cn.ts` helper added.
- Rewritten page-level clients with mobile-first layouts:
  - `HomeClient` — centered hero with compass SVG, stacked CTAs.
  - `ChooseGameClient` — vertical mode cards.
  - `SetupClient` — stacked input + crew list + deck-variant picker + sticky bottom Start CTA. Deck variant picker exposes all three variants (greedy / even_greedier / super_greedy).
  - `PlayLocalClient` — top bar (deck + pirate count + leave), status banner, big card display, streak strip, player list, sticky bottom action bar (Plunder + Bury It side-by-side; "Pass the Helm" replaces them on pirate).
  - `ProfilePage` — restyled with PiratePanel + display font.
  - `NamePromptModal` — converted to PirateModal bottom-sheet.
  - `not-found` — restyled.

**Verified**
- `npm run typecheck` clean.
- `npm run test:run` — 21/21 engine tests pass.
- `npm run build` clean (8 routes).
- `npm run dev` — all routes 200/307 as expected.

**Known caveats**
- Visual smoke test (loading at 360px / 414px / desktop, finishing a game) hasn't been done in-session. Recommend a real device test before merging.
- Legacy primitives (`src/ui/button`, `panel`, `page`, `modal`, etc.) remain in the tree but are no longer used by any page-level client. Safe to delete in a cleanup pass once we confirm nothing depends on them.
- Open Graph image still uses the legacy SVG — refresh in a later pass.

## Phase 3 — Multiplayer rooms ✅ COMPLETE (2026-06-10)

**Shipped**
- `src/game/public.ts` — `PublicGameState`, `RoomState`, `toPublic()` that strips the `deck` from broadcast payloads. Clients never see remaining deck contents.
- `src/server/game-room.ts` — room lifecycle module:
  - `generateRoomCode()` — 4 chars from 30-char alphabet (no `0/O/1/I/L`), `crypto.getRandomValues`. ~810k combos with retry-on-collision.
  - `createRoom`, `findGameByCode`, `findCompletedOrActiveGame`, `isUserInGame`, `loadRoomForUser`, `parseEngineState`, `isPlayerTurn`.
  - `applyAction(gameId, action, eventType, options)` — central transactional helper: loads state, calls `engine.reduce`, writes back, runs `onPlayers` callback for `game_players` syncs, inserts a `game_events` row with monotonic `seq` and the sanitized `PublicGameState` payload.
- Server actions:
  - `createRoom()` — host opens a room, gets auto-seated.
  - `joinRoom({code})` / `leaveRoom(code)` — lobby joins/leaves with seat allocation.
  - `startOnlineGame({code})` — host-only, seeded `START_GAME` (UUID seed) with `crypto.randomUUID()`.
  - `drawOnline / bankOnline / endTurnOnline` — turn validation (`current_player_id === auth.uid()`), engine reduce, `game_players.coins`/`isWinner` syncs.
- `supabase/migrations/20260610190000_realtime_publication.sql` — adds `game_events` and `game_players` to the `supabase_realtime` publication so clients get postgres-changes INSERTs.
- `src/client/realtime/useGameRoom.ts` — subscribes to `game_events` INSERTs filtered by `game_id`, replaces state from `payload.state` each event.
- Pages:
  - `/play/new` — RSC auto-fires `createRoom()`, redirects to `/play/{code}`.
  - `/play/join` — client form, accepts 4-char code, calls `joinRoom`.
  - `/play/[code]` — RSC validates membership, hydrates `RoomState` from DB, renders `OnlineRoomClient`. Non-members get a `JoinGate` (lobby) or "voyage be underway" error (active/complete).
- `OnlineRoomClient` — switches between `Lobby` (share code, native share / clipboard fallback, host start CTA) and `Play` (top bar + status banner + flip card + streak strip + player list + sticky action bar). Non-current players see "Waiting on X…" instead of buttons.
- Re-enabled "Play Online" CTA in `/choose-game` with both "Open a Room" and "Join with Code" entry points.

**Verified**
- `npm run typecheck` clean.
- `npm run test:run` — 21/21 engine tests still passing (engine itself unchanged).
- `npm run build` clean (12 routes including `/play/[code]`, `/play/join`, `/play/new`).
- `npm run dev` — `/`, `/choose-game`, `/play/join`, `/play/new` all return 200.
- DB verified: `game_events` and `game_players` are in `supabase_realtime` publication.

**Known caveats**
- Two-device end-to-end test (host + joiner on actual devices, finishing a game) hasn't been done in-session. Recommend before merging.
- No presence / disconnect detection yet. If a player drops mid-turn, the table waits indefinitely. Defer to a polish pass with `supabase.channel().on('presence', ...)`.
- No "host left" handling. If the host abandons a lobby, the room sits stale. Defer (daily cron will prune stale lobbies eventually).
- Game state JSONB on `games.state` still includes the `deck`. RLS allows members to read the whole row — a determined cheater could `supabase.from('games').select('state')` and see the remaining deck. Recommend tightening: either column-grant SELECT to a subset, or split deck into a service-role-only table. Filed as a follow-up.
- Lobby UI doesn't show a spinner when a new player joins between events — works (postgres-changes on `game_players` is in the publication) but the realtime hook only subscribes to `game_events`. The host sees joins because `joinRoom` writes a `PLAYER_JOIN` event with the updated public state.
- Online mode currently uses the host-selected default variant (`even_greedier`). UI doesn't expose variant choice yet — matches Paul's preference for hidden variants.

See `.claude/docs/roadmap.md`.

## Phase 4 — Stats, polish, email upgrade ✅ PARTIAL (2026-06-10)

**Shipped**
- **Deck secrecy hardened.** `supabase/migrations/20260610200000_tighten_games_rls.sql` drops the `games_member_read` RLS policy. Clients can no longer SELECT from `games` (and therefore cannot read `state.deck`). Server reads go through Drizzle which bypasses RLS. Realtime broadcasts use the sanitized `PublicGameState` in `game_events.payload`.
- **`user_stats` populated.** New `src/server/stats.ts` exports `bumpUserStats(tx, rows[])` using Drizzle UPSERT with column increments. Hooked from two places:
  - `applyAction` detects the `lobby|active → complete` transition and bumps every player.
  - `persistLocalGame` bumps stats for the host when their `displayName` matches a seat (the only persisted user in local mode).
- **Profile page** now reads from `user_stats` rather than re-deriving. Adds a third stat row for total doubloons collected and a win-rate suffix. Differentiates `local` vs `online` mode in the recent voyages list.
- **Account upgrade (anonymous → email).** `src/client/auth/AccountUpgrade.tsx`: collapsible card on `/profile` shown only to anonymous users. Uses browser `supabase.auth.updateUser({email, password})` to convert the anon JWT into a permanent email account. Server action `markAccountClaimed` mirrors `auth.users.is_anonymous` into `public.users.is_anonymous` and revalidates the profile path. Stats and game history carry over because the underlying `user_id` is unchanged.

**Verified**
- `npm run typecheck` clean.
- `npm run test:run` — 21/21 engine tests still passing.
- `npm run build` — clean, 11 routes.
- Local Supabase confirmed publication still includes `game_events` and `game_players`; `games_member_read` policy is gone.

**Deferred (later passes)**
- Presence + disconnect timers in lobby/play. Stretch: replace the `Waiting on X…` text with a real online/offline dot.
- Per-player pirate count and longest-streak stats (engine needs to expose more telemetry).
- Leaderboards (global / weekly).
- Sound effects and richer animations beyond the existing card flip + coin pop.
- Playwright E2E for the multiplayer happy path across two browser contexts.
- Host-left handling: auto-promote next seat when host abandons mid-game.

## Phase 4.5 — Memory hygiene + DB cleanup ✅ COMPLETE (2026-06-11)

**Shipped**
- **Tab-visibility-aware realtime.** `useGameRoom` listens for `visibilitychange`. When the tab goes hidden it tears down the Supabase channel (status → `paused`). When it returns, it resubscribes and fires an optional `onResume` callback. `OnlineRoomClient` uses that callback to `router.refresh()`, re-running the RSC initial fetch so the player picks back up on the latest server state even if they missed broadcasts while hidden.
- **`abandon_stale_games()` SQL function.** Lobbies older than 2h → `abandoned`. Active games with no `game_events` activity for 6h → `abandoned`. Returns counts.
- **`prune_old_events()` SQL function.** Deletes `game_events` rows older than 30 days. Recent replays still possible.
- **`/api/cron/cleanup` route (Node runtime).** Guards on `Authorization: Bearer ${CRON_SECRET}`. Calls both SQL functions and returns a summary JSON.
- **`vercel.json`** schedules the cron route daily at 03:00 UTC. Vercel auto-injects the `CRON_SECRET` header for scheduled invocations.
- **`.env.example` and `.env.local`** updated with the `CRON_SECRET` slot. Dev value is `dev-cron-secret`.
- Locally verified: hitting the route with the bearer returned `200` with abandoned-row counts; without auth returned `401`.

**Why this matters**
- Multiple background tabs no longer hold open Supabase Realtime WebSockets when hidden — kills the main suspect for the overnight memory blowup.
- DB no longer accumulates orphan lobby rows or unbounded `game_events`. Free-tier storage stays healthy as usage grows.
- Cron runs once per day (Vercel Hobby limit). For more aggressive cleanup or for local testing, hit the route directly: `curl -H "Authorization: Bearer dev-cron-secret" http://localhost:3000/api/cron/cleanup`.

**Known caveats**
- If a user opens many tabs and rapidly switches between them, each `visible` transition fires `router.refresh()`. Acceptable but could be debounced if it ever feels janky.
- `prune_old_events` retains 30 days. If `games.state` history matters for replay, consider also persisting a final snapshot per-game. Currently the final state lives only in the latest `game_events` row before pruning kicks in.
- Realtime "paused" status is shown via the existing connection dot — amber pulsing. Could add a distinct "Z" icon later if desired.

See `.claude/docs/roadmap.md`.

## Phase 4.6 — Production deployment ✅ SHIPPED (2026-06-12)

**Shipped**
- Production Supabase project provisioned (ref `fyuasgpjrphxrituofsm`, us-west-1). Anonymous sign-ins enabled. Site URL set to `https://www.greedypirate.com` with localhost/www/apex in Redirect URLs.
- Preview Supabase project provisioned (ref `iosokzbammerxzyfuboc`, us-west-1) as an isolated DB for PR previews.
- Both projects migrated: Drizzle schema (5 tables) + Supabase RLS/triggers/cleanup (4 SQL files).
- 5 Vercel env vars set at production scope (CLI piping) and preview scope (dashboard — CLI fails interactive prompt under agent detection).
- Vercel project Node.js bumped 18.x → 24.x (18 retired).
- `.gitignore` updated: `.env*` and `.claude/settings.local.json`. `.env.local` is no longer committed (the doc's old claim that local Supabase keys are committed is obsolete — keys live in `.env.local` per dev machine, recoverable from `supabase status`).
- Daily Vercel cron live at https://www.greedypirate.com/api/cron/cleanup. Verified 200 with `Authorization: Bearer $CRON_SECRET` (use `www` subdomain — curl drops auth on apex redirect).
- Smoke pass: anonymous sign-in, name prompt, local game persist, profile stats, multiplayer room across desktop/phone, account upgrade flow.

**Known caveats**
- Email verification redirect previously pointed at `localhost:3000` until URL Configuration was set.
- The Vercel CLI's `vercel env add ... preview --value '...' --yes` exits 1 in agent contexts because it interactively asks "all preview branches?" — use the dashboard for preview-scope vars.
- `app/api/cron/cleanup` (via `src/server/db/client.ts:7`) throws at module-load if `DATABASE_URL` is unset, which fails local `npm run build` when `.env.local` was overwritten by `vercel env pull` without a re-paste of the Supabase keys. Restore from `supabase status` output.

## Security & architecture hardening ✅ IN PROGRESS (2026-06-18)

Working the audit backlog filed in Linear (GRE-5…33). Shipped to `main` (each its own PR, server-authoritative + RLS principles intact):

- **GRE-5** — lock the `games` row during `applyAction` so concurrent actions can't lose updates (#21).
- **GRE-6** — realtime moved to **private channels** + RLS on `realtime.messages` (`is_room_member` / `is_own_knock_topic`); knock verdicts on per-user `knock:{USER_ID}` topic; `lobby:public` stays public.
- **GRE-7** — auth-callback `next` validated to a same-origin path (open-redirect fix).
- **GRE-8** — `CRON_SECRET` compared in constant time (`timingSafeEqual`).
- **GRE-9** — admin rooms page masks host emails server-side (PII); raw email never sent to client.
- **GRE-10** — broadcasts carry a monotonic `version` (`game_events.seq`); client version-gates and drops stale/out-of-order payloads; resume applies RSC state only if newer.
- **GRE-13** — raw-SQL `db.execute` results validated with Zod via `parseRows` (no more `as unknown as T[]`).
- **GRE-14** — middleware session refresh scoped to auth-sensitive routes (`needsSessionRefresh`); `getUser()` kept where it matters, so auth isn't weakened.
- **GRE-18** — screen-reader announcements: always-mounted polite/assertive live regions, parallel text for visual-only effects, accessible names on modals.
- **GRE-33** — channel-lifecycle hotfix: drop any stale same-topic realtime channel before resubscribe (fixes presence-after-subscribe + RLS-denied-read on resume; a GRE-6 regression).

**Still open (Linear):** GRE-11 (atomic continuation-finalize) → unblocks GRE-12/16; GRE-15 (latent nits); GRE-17 (modal focus trap); GRE-19 (contrast); GRE-20/21/22 (UI/a11y, unblocked by GRE-18); GRE-23 (core bank-vs-push loop) → gates 24–32. See Linear for the live board.

## Phase 5 — Stretch goals ⏳

See `.claude/docs/roadmap.md`.
