# Stack

Versions pinned to latest stable as of mid-2026. Update this doc when bumping majors.

## Core

| Package | Version | Why |
|---|---|---|
| `next` | `^15` | App Router, RSC, Server Actions, native middleware. Vercel-first. |
| `react` / `react-dom` | `^19` | Stable, ships with Next 15. Async transitions, `use()`, Actions. |
| `typescript` | `^5.6` | Strict mode + `noUncheckedIndexedAccess`. Target ES2022, `moduleResolution: bundler`. |
| `tailwindcss` | `^4` | Faster build, CSS-first config via `@theme` + `@custom-variant`. |

## Backend

| Package | Why |
|---|---|
| `@supabase/supabase-js` | Auth (anonymous + email), Realtime channels (broadcast). |
| `@supabase/ssr` | Cookie-based auth for Next App Router. |
| `drizzle-orm` + `postgres` | Type-safe SQL via Drizzle, connection via `postgres.js`. Edge-friendly, no Rust binary. |
| `drizzle-kit` (dev) | Schema migrations + Drizzle Studio. |
| `server-only` (dev) | Compile-time guard on server-only modules. |

We connect Drizzle directly to the Supabase Postgres connection string (NOT through the Supabase JS client) — gives us full SQL power and Drizzle's type inference. Supabase JS client is reserved for Auth + Realtime + Admin SDK calls.

## State & data

| Package | Why |
|---|---|
| `zustand` | Tiny, no boilerplate. Local game store. Realtime hook uses plain `useState`. |
| `zod` | Schema validation at trust boundaries (server actions). |

## UI

| Package | Why |
|---|---|
| `tailwind-merge` + `clsx` | Conditional class composition via `src/lib/cn.ts`. |
| `react-aria-components` | Installed but not yet used; reserved for accessible primitives if we need them later. |

Pirate design tokens live in `app/globals.css` (`@theme`). Bespoke `PirateButton`/`PirateCard`/`PirateModal`/`PiratePanel` in `src/ui/pirate-*`. Inline SVGs for card art and the home compass — no icon library required.

## Dev / quality

| Package | Why |
|---|---|
| `vitest` | Fast unit tests for `src/game/` engine. |
| `eslint` + `eslint-config-next` | Lint. |
| `prettier` | Format. |
| `dotenv` | Load `.env.local` in Drizzle Kit config. |

## Tooling scripts

| Script | Purpose |
|---|---|
| `scripts/dev-lan.mjs` | Detects laptop LAN IP, overrides `NEXT_PUBLIC_SUPABASE_URL`, runs `next dev -H 0.0.0.0`. Invoked via `npm run dev:lan`. |

## Removed from old deps

- `ably` — replaced by Supabase Realtime.
- `@svgr/cli` — kept (only used by `npm run svg`); not on the runtime path.

## Why broadcast over postgres_changes for realtime

Postgres-changes deliveries are gated by the realtime websocket's JWT passing RLS. Unreliable for anonymously signed-in users in our setup (auth.uid() can be NULL during the handshake → all policies fail → no events). Broadcast skips RLS entirely:
- Server publishes via `POST /realtime/v1/api/broadcast` with service-role auth.
- Clients subscribe to `room:{CODE}` topics with the anon key.
- No per-row RLS checks, lower latency, more predictable.

Postgres-changes is still in the publication for `game_events` so we can debug via Supabase Studio, but it's not the live delivery channel.

## Why Drizzle over Prisma

- No Rust binary → faster cold starts on Vercel serverless.
- SQL-shaped API → easier to reason about if you know SQL.
- Schema is plain TypeScript, not a separate DSL.
- Edge-runtime compatible.

## Why Supabase Realtime over Ably / Pusher

- Bundled with the same DB + Auth. Fewer SDKs, one bill.
- Free tier sufficient (200 concurrent, 2M msgs/mo).
- Broadcast REST endpoint = no SDK subscription required on the server.

If latency ever feels bad in production, we have a clean swap path: only `src/server/realtime/broadcast.ts` and `src/client/realtime/useGameRoom.ts` need to change.

## Why Zustand over Context/Redux

- Context re-renders the entire tree on update. Bad for animations.
- Redux Toolkit is overkill for this scope.
- Zustand: ~1KB, selectors built-in, no provider boilerplate.

## Why no separate API layer (tRPC, etc.)

Server Actions cover mutations. RSC covers reads. Realtime broadcast covers cross-client state. Adding tRPC is a layer we don't need yet.
