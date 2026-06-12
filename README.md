# Greedy Pirate

A risk-and-reward card game. Players draw from a shared deck of gold and pirate cards. Build a streak, bank the loot, or push your luck and lose it all to a pirate. Highest coin total when the deck runs out wins.

**Modes**

-  **Local** — one device, pass-and-play with 2–10 friends.
-  **Online** (coming soon) — multiplayer rooms across devices.

Live: <https://greedypirate.com>

Mobile-first PWA built on Next.js + Supabase.

---

## Tech stack

-  [Next.js 15](https://nextjs.org/) (App Router, RSC, Server Actions)
-  React 19, TypeScript 5
-  Tailwind CSS 4
-  [Supabase](https://supabase.com) — Postgres + Auth (anonymous + email) + Realtime
-  [Drizzle ORM](https://orm.drizzle.team) + `postgres.js`
-  Zustand for client state
-  Vitest for unit tests
-  Deployed on Vercel

---

## Prerequisites

| Tool               | Version | Why                                                                                                                                                                         |
| ------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**        | ≥ 20    | App runtime. `node --version` to check. Install via [nvm](https://github.com/nvm-sh/nvm).                                                                                   |
| **npm**            | ≥ 10    | Package manager. Ships with Node 20.                                                                                                                                        |
| **Docker Desktop** | latest  | Required to run the local Supabase stack. [Install](https://docs.docker.com/desktop/).                                                                                      |
| **Supabase CLI**   | ≥ 2.0   | Manages the local Postgres/Auth/Realtime stack. `brew install supabase/tap/supabase` on macOS, or see [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli). |

That's it.

---

## Running locally

```bash
# 1. Clone
git clone git@github.com:paulRagar/greedy-pirate.git
cd greedy-pirate

# 2. Install dependencies
npm install

# 3. Start the local Supabase stack (Postgres, Auth, Studio)
npm run supabase:start

# 4. Apply DB migrations
npm run db:migrate
supabase db push --local      # applies RLS policies and triggers

# 5. Start the dev server
npm run dev
```

Open <http://localhost:3000>. Hot reload is on — saving any file refreshes the browser.

The first time you load the app you'll be silently signed in as an anonymous user and prompted to pick a crewmate name. That's it — you're playing.

> **Tip:** Local Supabase keys are committed to `.env.local` because they're shared defaults across every local install. They're not secret in dev. Production keys go in Vercel env vars (and a separate `.env.production.local` if you need to run prod-pointing commands locally — never commit that one).

### Companion URLs (local)

| What                                | URL                     |
| ----------------------------------- | ----------------------- |
| App                                 | http://localhost:3000   |
| Supabase Studio (DB GUI)            | http://127.0.0.1:54323  |
| Supabase API                        | http://127.0.0.1:54321  |
| Mailpit (catches auth emails)       | http://127.0.0.1:54324  |
| Drizzle Studio (alternative DB GUI) | run `npm run db:studio` |

### Stopping

```bash
npm run supabase:stop          # stops Postgres/Auth/etc Docker containers
# Ctrl+C the Next dev server
```

### Resetting the local DB

```bash
npm run supabase:reset         # wipes the local DB and re-runs all migrations
```

---

## Available scripts

| Command                  | What it does                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Start the local dev server with hot reload (localhost only).                                              |
| `npm run dev:lan`        | Detect LAN IP, override `NEXT_PUBLIC_SUPABASE_URL`, bind Next to `0.0.0.0`. Use when testing from a phone or second device on the same Wi-Fi. |
| `npm run build`          | Production build. Run before opening a PR.                                                               |
| `npm run start`          | Serve the production build locally. Run `npm run build` first.                                           |
| `npm run lint`           | ESLint check.                                                                                            |
| `npm run typecheck`      | TypeScript check without emitting.                                                                       |
| `npm run test`           | Vitest in watch mode.                                                                                    |
| `npm run test:run`       | Vitest single run. CI-friendly.                                                                          |
| `npm run db:generate`    | Generate a new Drizzle migration after editing `schema.ts`.                                              |
| `npm run db:migrate`     | Apply Drizzle migrations to the current `DATABASE_URL`.                                                  |
| `npm run db:push`        | Push schema without writing a migration file (dev only).                                                 |
| `npm run db:studio`      | Open Drizzle Studio (web GUI).                                                                           |
| `npm run supabase:start` | Start the local Supabase stack (Docker).                                                                 |
| `npm run supabase:stop`  | Stop the local Supabase stack.                                                                           |
| `npm run supabase:reset` | Wipe the local DB and re-run all migrations.                                                             |
| `npm run svg`            | Regenerate React components from SVG assets in `public/assets/icons`. Only needed when adding new icons. |

---

## Production Supabase setup

See `.claude/docs/supabase-setup.md` for the step-by-step walkthrough — creating the cloud project, enabling anonymous sign-ins, grabbing keys, setting Vercel env vars, and running migrations against production.

---

## Project layout

```
/app                        Next.js routes (App Router, RSC by default)
  /                         home / choose-game / setup
  /play-local               local pass-and-play game
  /play/new                 server-side room creation + redirect
  /play/join                client form for joining by code
  /play/[code]              online lobby + active room
  /profile                  stats + account upgrade
  /api/cron/cleanup         daily cron (Bearer CRON_SECRET)
/src
  /game                     Pure game engine — rules, deck, state machine
  /server                   Server-only: DB client, Drizzle schema, Supabase clients, server actions, realtime broadcaster, stats helpers
  /client                   Client-only: zustand stores, hooks, supabase browser client, auth bootstrap, realtime subscriber
  /ui                       Shared UI components — pirate-* primitives + legacy UI atoms
  /lib                      Cross-cutting utils (cn)
/supabase                   Supabase CLI workspace: config.toml + migrations (RLS, triggers, cleanup functions, realtime publication)
/scripts                    Dev tooling (dev-lan.mjs)
/public                     Static assets
/.claude/docs               Planning + reference docs (architecture, stack, roadmap, db, setup, progress)
CLAUDE.md                   Top-level context for AI tooling
middleware.ts               Next middleware (refreshes Supabase session per request)
vercel.json                 Vercel cron schedule
```

Many sub-directories have their own `CLAUDE.md` with scoped context (see `src/game/`, `src/server/`, `src/client/`).

---

## Where to read more

-  **`CLAUDE.md`** — top-level project context.
-  **`.claude/docs/architecture.md`** — system design, multiplayer flow, security model.
-  **`.claude/docs/stack.md`** — pinned versions + rationale.
-  **`.claude/docs/roadmap.md`** — phased build plan.
-  **`.claude/docs/database.md`** — Postgres schema.
-  **`.claude/docs/game-rules.md`** — rules, state machine, deck variants.
-  **`.claude/docs/conventions.md`** — code style and patterns.
-  **`.claude/docs/supabase-setup.md`** — local + prod Supabase walkthrough.
-  **`.claude/docs/progress.md`** — current phase status.

---

### Code style

-  TypeScript strict mode (`noUncheckedIndexedAccess` on). No `any`.
-  Server Components by default; add `'use client'` only when needed.
-  Mobile-first UI. Touch targets ≥ 44×44px. Test at 360px width.
-  No comments that restate what the code does. Comments are for **why**, not **what**.
-  See `.claude/docs/conventions.md` for the full list.

---

## Deployment

Push to `main` → Vercel auto-deploys to <https://greedypirate.com>. Preview deployments are auto-created for every PR.

Env vars to set in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `CRON_SECRET`. See `.claude/docs/supabase-setup.md` for full details.

A daily Vercel cron job hits `/api/cron/cleanup` to abandon stale rooms and prune old events. The schedule lives in `vercel.json`; Vercel auto-injects the `CRON_SECRET` Bearer header.

---

## Troubleshooting

| Symptom                                | Fix                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install` peer-dep errors          | Delete `node_modules` and `package-lock.json`, re-run `npm install`.                                                                      |
| `supabase start` hangs                 | Docker Desktop not running, or another container is using ports 54321/54322/54323. Run `npm run supabase:stop` and retry.                 |
| App shows `DATABASE_URL is not set`    | You didn't copy `.env.local` (it's committed for shared local defaults). Pull latest.                                                     |
| Anonymous sign-in returns 422          | `enable_anonymous_sign_ins` is `false`. Local: edit `supabase/config.toml`. Cloud: Auth → Providers → Anonymous.                          |
| Tailwind classes not applying          | Check `app/globals.css` uses `@import 'tailwindcss'` (v4 syntax). CSS modules need an `@reference` directive — see `Checkbox.module.css`. |
| `Module not found: @/...`              | Path aliases live in `tsconfig.json`. Check the import matches.                                                                           |
| Profile page is empty after first game | Check the `on_auth_user_created` trigger fired (Studio → Database → Triggers). If not, re-run `supabase db push --local`.                 |
| Port 3000 in use                       | Next picks the next free port automatically. Or `lsof -i :3000` to find the offender.                                                     |
| Phone can't sign in over LAN           | You ran `npm run dev` instead of `npm run dev:lan`. The phone tries to reach Supabase at `127.0.0.1`. Restart with `npm run dev:lan` and reload the phone. |
| `Live` dot stuck amber on play screen  | Realtime can't connect. Check Supabase Docker stack is up (`docker ps`) and `NEXT_PUBLIC_SUPABASE_URL` is reachable from the device.       |
| `/api/cron/cleanup` returns 401        | Missing/wrong `CRON_SECRET`. Local default is `dev-cron-secret`; send `Authorization: Bearer dev-cron-secret`.                            |
| Dev server feels sluggish after days   | Next HMR memory grows over time. Restart `npm run dev`. Not a code issue.                                                                 |

---

## License

Private. All rights reserved.
