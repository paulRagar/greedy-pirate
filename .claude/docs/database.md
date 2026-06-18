# Database

Postgres on Supabase. Schema managed with Drizzle. All times in UTC (`timestamptz`).

## Design principles

- **Game state as JSONB.** The active game state (deck, current card, streak, etc.) lives in a single JSONB column on `games`. Cheap to read/write, evolves without migrations.
- **Events as separate rows.** Every action (draw, bank, end turn, join, start, end) writes a `game_events` row carrying the sanitized `PublicGameState`. Enables replay, audit, debugging — does NOT replace the JSONB state on `games` (that is the source of truth for "now"; events are the journal).
- **Stats are projected.** `user_stats` is updated incrementally on game completion via `bumpUserStats` (Drizzle UPSERT). Don't rely on it for forensic accuracy — re-derive from `games` + `game_players` if you suspect drift.
- **RLS as defense in depth.** Anon/authenticated clients are denied direct SELECT on `games`. Server code reads via Drizzle (service-role) and broadcasts sanitized state through Supabase Realtime broadcast. The **server** publish path bypasses RLS (service-role REST), but **client** subscribe/send is now RLS-gated: room/knock topics are private channels with policies on `realtime.messages` (GRE-6, see below).
- **Secure IDs.** All primary keys use `gen_random_uuid()` (pgcrypto). Room codes use `crypto.getRandomValues` from a 30-char alphabet.

---

## Tables

### `users`
Supabase Auth manages `auth.users`. We add a profile table; the `handle_new_user` trigger auto-creates a row on every `auth.users` insert.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | FK → `auth.users.id`. Same id for anon and email users. |
| `display_name` | `text` not null | Player's chosen name. Defaults to `Crewmate` until the name prompt completes. |
| `email` | `text` nullable | Mirror of `auth.users.email`. Populated by the `handle_new_user` insert trigger and the `sync_user_email` update trigger so anon→email upgrades stay in sync. Null for anonymous users. Protected by the `users_self_read` RLS policy. |
| `is_anonymous` | `boolean` default true | Flipped to false when `markAccountClaimed` runs after an email upgrade. |
| `created_at` | `timestamptz` default now() | |

### `games`
One row per match (lobby, active, complete, or abandoned).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `code` | `text` nullable | 4-char room code for online games. Null for local games. |
| `host_id` | `uuid` not null | FK → `users.id`. |
| `mode` | `text` not null | `'local'` or `'online'`. |
| `deck_variant` | `text` not null | `'greedy'`, `'even_greedier'`, `'super_greedy'`. Default selection is `'even_greedier'` — variant picker is hidden from setup UI. |
| `status` | `text` not null | `'lobby' \| 'active' \| 'complete' \| 'abandoned'`. |
| `state` | `jsonb` not null default `'{}'` | Full engine state including `deck`. **Service-role only.** |
| `current_player_id` | `uuid` nullable | Whose turn it is during `active`. |
| `started_at` | `timestamptz` nullable | When status → `active`. |
| `completed_at` | `timestamptz` nullable | When status → `complete` or `abandoned`. |
| `created_at` | `timestamptz` default now() | |

Indexes:
- `games_code_active_idx` — partial unique on `(code) where status in ('lobby','active') and code is not null`.
- `games_host_idx` — non-unique on `host_id`.

### `game_players`
Membership in a game. One row per (game, seat). For online games every seat is tied to a `user_id`; for local games `user_id` is null on all seats (guests on the host's device).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `game_id` | `uuid` not null | FK → `games.id` on delete cascade. |
| `user_id` | `uuid` nullable | FK → `users.id`. Nullable for local-mode guests. |
| `seat` | `int` not null | Turn order (0-indexed). |
| `display_name` | `text` not null | Snapshotted at join (in case the user renames later). |
| `coins` | `int` not null default 0 | Banked total this game. |
| `pirates_encountered` | `int` not null default 0 | Reserved; not populated yet. |
| `is_winner` | `boolean` not null default false | Set when game completes. |
| `joined_at` | `timestamptz` default now() | |
| `left_at` | `timestamptz` nullable | If they bailed mid-game. |

Constraints: unique `(game_id, seat)`. Indexes on `game_id` and `user_id`.

### `game_events`
Append-only log of actions. Drives replay and audit. **Not** the delivery channel for realtime (broadcast does that).

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `game_id` | `uuid` not null | FK → `games.id` on delete cascade. Indexed. |
| `seq` | `int` not null | Monotonic per-game sequence. Also the broadcast **version**: clients drop any `state` broadcast with `version ≤` the last applied (GRE-10). Always derive via `max(seq)+1`, never `COUNT(*)`. |
| `actor_id` | `uuid` nullable | User who performed the action (null for system events). |
| `type` | `text` not null | `'PLAYER_JOIN' \| 'PLAYER_LEAVE' \| 'START_GAME' \| 'DRAW' \| 'BANK' \| 'END_TURN' \| 'GAME_ENDED'`. |
| `payload` | `jsonb` not null default `'{}'` | Carries `{ state: PublicGameState, actorId, eventType }`. |
| `created_at` | `timestamptz` default now() | |

Constraints: unique `(game_id, seq)`.

Pruning: `prune_old_events()` deletes rows older than 30 days (daily cron).

### `user_stats`
One row per user. Materialized aggregates updated incrementally.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` PK | FK → `users.id` on delete cascade. |
| `games_played` | `int` default 0 | |
| `games_won` | `int` default 0 | |
| `total_coins_collected` | `bigint` default 0 | Sum of `coins` across completed games. |
| `total_pirates_encountered` | `int` default 0 | Reserved; not populated yet. |
| `longest_streak_value` | `int` default 0 | Reserved; not populated yet. |
| `updated_at` | `timestamptz` default now() | |

Populated by `bumpUserStats(tx, rows[])` (UPSERT with column increments) called from:
- `applyAction` on `lobby|active → complete` (online mode: all seated users).
- `persistLocalGame` (local mode: host only, matched by `displayName`).

---

## State JSONB shape

The `games.state` column holds the live game state managed by the engine.

```ts
type GameStateJSON = {
   players: Player[];
   turnIndex: number;
   deck: Card[];              // remaining cards, in order. Server-only.
   currentCard: Card | null;
   currentStreak: GoldCard[]; // gold cards in this turn's streak
   pirateCount: number;
   winnerId: string | null;
};
```

`deck` is **never sent to clients**. The server reads `deck[0]`, calls `reduce`, and broadcasts a `PublicGameState` that omits `deck` entirely (only `deckCount` is exposed).

---

## RLS policies

RLS is enabled on every public table. Current policies:

```sql
-- users: read + update own row
create policy users_self_read   on public.users      for select using (auth.uid() = id);
create policy users_self_update on public.users      for update using (auth.uid() = id);

-- user_stats: read own row
create policy user_stats_self_read on public.user_stats for select using (auth.uid() = user_id);

-- games: NO SELECT policy. Clients cannot read games directly.
--   Server-side reads go through Drizzle (service-role bypass).
--   Server-side broadcasts deliver sanitized state to clients.

-- game_players: readable by co-members or the host
create policy game_players_co_member_read on public.game_players for select using (...);

-- game_events: readable by co-members or the host (audit log)
create policy game_events_co_member_read on public.game_events   for select using (...);

-- All writes go through server actions using the service-role DATABASE_URL.
-- No public write policies are needed.
```

**Realtime (`realtime.messages`)** — added in `20260618000000_realtime_private_room_channels.sql` (GRE-6). Private channels are deny-by-default; two permissive policies open them to the right members:

```sql
-- room:{CODE} — host / seated (not-left) player / spectator of a lobby|active game.
--   SECURITY DEFINER helper realtime.is_room_member(topic) reads games/game_players/
--   game_spectators (the authenticated role has no SELECT grant on those).
create policy "room members access their room topic" on realtime.messages
   for all to authenticated
   using (realtime.is_room_member(realtime.topic()))
   with check (realtime.is_room_member(realtime.topic()));

-- knock:{USER_ID} — only the user whose id matches the topic suffix
--   (realtime.is_own_knock_topic), so a pending join-requester learns the verdict
--   without seeing room state.
create policy "users access their own knock topic" on realtime.messages
   for all to authenticated
   using (realtime.is_own_knock_topic(realtime.topic()))
   with check (realtime.is_own_knock_topic(realtime.topic()));
```

Notes:
- The `games_member_read` policy that earlier drafts included was **dropped** in `20260610200000_tighten_games_rls.sql` to harden deck secrecy.
- `lobby:public` is a public channel (no RLS consulted) — it carries only the sanitized matchmaking list.

---

## Cleanup functions

Defined in `20260611100000_cleanup_functions.sql`. Invoked daily by `/api/cron/cleanup` (Vercel Cron):

| Function | Behavior |
|---|---|
| `abandon_stale_games()` | Lobbies older than 2h → `abandoned`. Active games with no `game_events` in 6h → `abandoned` (sets `completed_at`). Returns `(abandoned_lobbies, abandoned_active)`. |
| `prune_old_events()` | Deletes `game_events` rows older than 30 days. Returns count. |

Later migrations add more maintenance functions the same cron route invokes (room-lifecycle revamp, `purge_old_games`, expired join-request cleanup, host migration, and continuation-window expiry/finalize). Each returns only freshly-changed rows so the route can fire one-shot broadcasts (e.g. host migration, knock expiry) for them. All granted `execute` on `service_role` (service role bypasses RLS anyway; explicit for clarity).

Local invocation:
```bash
curl -H "Authorization: Bearer dev-cron-secret" http://localhost:3000/api/cron/cleanup
```

---

## Migrations

Two systems coexist:

- **Drizzle migrations** — `src/server/db/migrations/`. Schema changes only. Generated via `npm run db:generate`, applied via `npm run db:migrate`.
- **Supabase migrations** — `supabase/migrations/`. Hand-written SQL for RLS, triggers, and cleanup functions. Applied via `supabase db push --local` (dev) or `supabase db push` (prod).

Rules:
- Never edit a committed migration. Always make a new one.
- The first Drizzle migration originally included `CREATE TABLE "auth"."users"` — we manually replaced it with a comment because Supabase Auth owns that table. If you ever regenerate from scratch you'll need to do the same edit by hand.

---

## Backup and dev workflow

- Supabase cloud free tier includes daily backups (7 days retention).
- Local dev: run Supabase locally via `npm run supabase:start` (Docker) for full parity.
- Use Supabase branching (free tier supports it) for preview environments.
- Cross-device dev: `npm run dev:lan` (detects LAN IP, points Supabase URL at it, binds Next to `0.0.0.0`).
