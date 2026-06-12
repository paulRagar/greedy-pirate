# `src/server/` — Server-only code

Anything in this directory MUST run only on the server. DB clients, Supabase server SDK, service-role key, server actions, business logic that mutates state.

## Sub-directories

- `db/` — Drizzle ORM client + schema + generated migrations.
- `supabase/` — Supabase clients: `server.ts` (cookie-aware, anon-scoped) and `admin.ts` (service-role, bypasses RLS).
- `actions/` — Server Actions. One file per action. Marked `'use server'`.
- `auth/` — Authentication helpers (planned).
- `realtime/` — Realtime publishers (Phase 3+).

## Rules

- Files here use `import 'server-only'` at the top to refuse browser bundling.
- Never import this directory from `src/client/`. Compile-time check is the `server-only` package.
- Use `supabaseAdmin` (service-role) when you need to bypass RLS to write trusted data. Use `getSupabaseServer()` when you need user-scoped reads that RLS enforces.
- Drizzle queries go through `db` from `./db/client`. Don't open new Postgres connections in random files.

## DB clients in one paragraph

`db` (Drizzle) — used for all reads/writes from server actions. Connects via `DATABASE_URL` to Postgres directly. Bypasses RLS (we're the service role at the connection level). Trust the caller. Validate inputs with Zod.

`getSupabaseServer()` — Supabase client with cookie context. Use for reading the current user (`auth.getUser()`) and for any read that should respect RLS as the user.

`supabaseAdmin` — service-role Supabase client. Currently unused; reserve for cases where we need Supabase APIs (Auth admin, Storage) without a user context.
