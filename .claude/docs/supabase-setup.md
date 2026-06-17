# Supabase setup

How to spin up the local dev stack, test multiplayer across devices, and provision the production project.

---

## Local development

Prerequisites: Docker Desktop running, Supabase CLI installed (`brew install supabase/tap/supabase`).

### One-time

The repo already includes `supabase/config.toml` (committed) and `supabase/migrations/` (committed). No init needed.

### Daily workflow

```bash
# Start the stack (Postgres, Auth, Studio, Realtime, etc.)
npm run supabase:start

# Apply Drizzle schema migrations (creates tables)
npm run db:migrate

# Apply Supabase migrations (RLS, auth trigger, cleanup functions)
supabase db push --local

# Start the Next dev server (laptop only)
npm run dev

# OR — start dev bound to LAN so phones/tablets can connect
npm run dev:lan
```

`npm run supabase:start` prints the local URLs and keys. `.env.local` is gitignored — recreate it on a new machine by running `supabase status` and copying the printed values into a file with the shape shown in `.env.example`.

### Slim local stack

`supabase/config.toml` disables Storage, Edge Functions, and Logflare analytics because Greedy Pirate does not use them. The running stack is **8 containers** (auth, db, inbucket, kong, pg_meta, realtime, rest, studio) instead of the default 13. If you ever add file uploads or edge functions, flip the relevant `enabled = false` back on, then `supabase stop` + `supabase start`.

### Fresh restart (wipe local data + images)

```bash
supabase stop --no-backup
docker volume rm supabase_db_greedy-pirate supabase_storage_greedy-pirate 2>/dev/null
mv supabase/migrations supabase/migrations.bak     # avoid RLS-before-tables chicken-egg
supabase start
mv supabase/migrations.bak supabase/migrations
npm run db:migrate                                  # Drizzle creates tables first
supabase db push --local                            # RLS, triggers, cleanup functions
```

The `mv` dance is required because Supabase auto-applies migrations during `start` on a fresh DB, and the RLS migration depends on `public.users` (a Drizzle-owned table). Order matters only on a truly fresh volume — daily `supabase start` against an existing volume is unaffected.

| Service | URL |
|---|---|
| Studio (web admin) | http://127.0.0.1:54323 |
| API | http://127.0.0.1:54321 |
| Postgres | postgres://postgres:postgres@127.0.0.1:54322/postgres |
| Mailpit (catches confirmation emails) | http://127.0.0.1:54324 |

When you change `schema.ts`:
```bash
npm run db:generate     # writes new SQL to src/server/db/migrations
npm run db:migrate      # applies it
```

To stop / reset:
```bash
npm run supabase:stop       # stops Postgres/Auth/etc Docker containers
npm run supabase:reset      # wipes the local DB and re-runs all migrations
```

### Note about the `auth.users` CREATE statement

The first Drizzle migration originally included `CREATE TABLE "auth"."users"` because `src/server/db/schema.ts` declares it for FK type safety. The committed migration has that statement replaced with a comment (Supabase Auth manages that table). If you ever regenerate from scratch, you'll need to make the same edit by hand.

---

## Cross-device testing (`npm run dev:lan`)

By default `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, which only resolves from the laptop. Phones on the same Wi-Fi can reach the Next dev server (Next binds to `0.0.0.0` automatically) but their browsers will try to reach Supabase at `127.0.0.1` — i.e. the phone itself, where nothing is running. Anonymous sign-in fails.

`npm run dev:lan`:
1. Detects the laptop's LAN IPv4 (e.g. `192.168.1.8`).
2. Overrides `NEXT_PUBLIC_SUPABASE_URL=http://192.168.1.8:54321` via `process.env` (precedes `.env.local`).
3. Spawns `next dev --turbopack -H 0.0.0.0`.

Open the phone's browser to the printed app URL (e.g. `http://192.168.1.8:3000`). Anonymous sign-in routes to the laptop's Supabase, you get a name prompt, you can join rooms.

If something fails, the `AuthErrorOverlay` in the app surfaces the underlying error and detects the page-host vs Supabase-host mismatch automatically.

---

## Realtime broadcast (not postgres_changes)

We use Supabase **broadcast** for room sync, not postgres-changes:

- After every transactional `applyAction`, the server POSTs to `${NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast` with the service-role key and the sanitized `PublicGameState`.
- Clients subscribe to `room:{CODE}` and receive every published `state` event.
- No RLS gates apply to broadcast delivery, so flaky JWT-on-WebSocket setups don't break the game.
- For the local stack, broadcast works out of the box once `supabase start` is up — no extra config required.

`game_events` is still in the `supabase_realtime` publication for backwards compatibility / debugging, but the client subscribes only to broadcast topics.

---

## Cron cleanup

`/api/cron/cleanup` runs daily on Vercel at 03:00 UTC (`vercel.json`). Locally, hit it manually:

```bash
curl -H "Authorization: Bearer dev-cron-secret" http://localhost:3000/api/cron/cleanup
```

It calls:
- `abandon_stale_games()` — lobbies > 2h → `abandoned`, active games idle > 6h → `abandoned`.
- `prune_old_events()` — deletes `game_events` older than 30 days.

The Bearer secret is `CRON_SECRET`:
- Local: `.env.local` ships with `CRON_SECRET=dev-cron-secret`.
- Production: set `CRON_SECRET` in Vercel env vars (pick any long random string). Vercel auto-injects it into scheduled cron calls.

Vercel Hobby tier caps cron at once per day. Upgrade to Pro if you want more frequent cleanup.

---

## Production setup (Supabase cloud)

### Step 1 — Create the project

1. Sign up at <https://supabase.com>.
2. Create a new project. Pick a region close to your users (e.g. `us-east-1`). Set a strong DB password — store it in a password manager.
3. Wait for provisioning (~2 minutes).

### Step 2 — Enable anonymous sign-ins + URL config

1. Dashboard → **Authentication** → **Providers** → scroll to **Anonymous Sign-ins** → toggle ON → **Save**. Confirm the page refreshes with the toggle still ON — it occasionally fails to persist on first save.
2. **Authentication** → **URL Configuration**:
   - **Site URL** = production domain (e.g. `https://www.greedypirate.com`).
   - **Redirect URLs** = add `https://www.greedypirate.com/**`, `https://greedypirate.com/**`, `https://*.vercel.app/**` (preview deploys), and `http://localhost:3000/**` (for local dev).
   - Email-change, password-reset, and signup-confirmation links all redirect through `/auth/callback`. Without these entries the links fall back to `localhost:3000` and break in prod.
3. **Authentication** → **Email**:
   - Enable **Secure email change** (double-confirm) — sends the change link to both the old AND new address. Recommended; without it a hijacked active session can silently steal the account.

### Step 3 — Grab the keys

From the project dashboard:
1. **Project URL** → e.g. `https://abcdefghijk.supabase.co`
2. **Project API keys** → copy:
   - `anon` / publishable key (safe to expose to browser).
   - `service_role` / secret key (server-only — NEVER expose to browser).
3. **Connect** button (top-right header) → **Transaction pooler** tab → copy URI (port `6543`, IPv4-compatible). Replace `[YOUR-PASSWORD]` with the DB password. URL-encode special chars in the password (`$` → `%24`, `&` → `%26`, `*` → `%2A`) — Vercel and Drizzle both parse the URL strictly.

### Step 4 — Set environment variables

**Locally** (`.env.production.local`, NOT committed):
```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres.abc:password@aws-...pooler.supabase.com:6543/postgres
CRON_SECRET=<a long random string>
```

**On Vercel** — two paths:

*CLI (fast, production scope works):*
```bash
printf 'VALUE' | vercel env add NAME production
```
Repeat for each of the 5 vars. Production scope accepts piped stdin without prompting.

*Dashboard (required for preview scope):* Project Settings → Environment Variables → Add New → set the 5 vars at **Preview** scope. The CLI prompts an interactive "all preview branches?" confirmation that auto-detected agent contexts cannot satisfy, so the dashboard is the path of least resistance for preview.

Also confirm **Project Settings → General → Node.js Version** is `24.x` (or current LTS). Vercel disabled 18.x; an old project locked to 18 will fail builds with `Found invalid or discontinued Node.js Version`.

### Step 5 — Push migrations to production

Migrations run automatically on every Vercel build via the `vercel-build` script (`scripts/ci-migrate.mjs`). Push to `main` → prod build runs Drizzle + Supabase migrations against the prod DB → Next builds → deploy. Push any other branch → same flow against the preview DB.

**Required Vercel env vars (per scope — Preview + Production):**

| Var | Value | Notes |
|---|---|---|
| `SUPABASE_DB_PASSWORD` | raw DB password | script URL-encodes for you — paste it raw |
| `SUPABASE_DB_HOST` | e.g. `aws-0-us-west-1.pooler.supabase.com` | session-pooler host (port 5432) |
| `SUPABASE_PROJECT_REF` | e.g. `fyuasgpjrphxrituofsm` | the project ref slug |
| `ADMIN_EMAILS` | comma-separated emails | server-side gate for `/admin/rooms` + admin actions; leave empty to lock everyone out |
| `NEXT_PUBLIC_ADMIN_EMAILS` | same value as `ADMIN_EMAILS` | UI-only mirror; shows the admin link in the account dropdown |

Add via dashboard or CLI:

```bash
printf 'RAW_PASSWORD' | vercel env add SUPABASE_DB_PASSWORD production
printf 'aws-0-us-west-1.pooler.supabase.com' | vercel env add SUPABASE_DB_HOST production
printf 'fyuasgpjrphxrituofsm' | vercel env add SUPABASE_PROJECT_REF production
# repeat for preview scope (dashboard for preview — CLI prompts non-interactively)
```

**Manual override / fallback** — if you ever need to push migrations by hand (e.g. CI is down or you want to dry-run):

```bash
supabase link --project-ref <ref>
DATABASE_URL=<prod-session-pooler-url> npx drizzle-kit migrate
supabase db push
```

**Skip migrations for a deploy** — set `SKIP_MIGRATIONS=1` in Vercel env, redeploy. Useful for infra-only changes when the script itself is broken.

### Step 6 — Verify

1. Open Supabase Studio (cloud dashboard → SQL editor) and run:
   ```sql
   select tablename from pg_tables where schemaname = 'public';
   ```
   You should see: `users`, `games`, `game_players`, `game_events`, `user_stats`.
2. Run:
   ```sql
   select proname from pg_proc where proname in ('handle_new_user', 'abandon_stale_games', 'prune_old_events');
   ```
   All three should be listed.
3. Trigger an anonymous sign-in from the app and confirm a row lands in `public.users`.
4. Hit `/api/cron/cleanup` with the prod Bearer secret. Use the `www` subdomain — the apex 301-redirects and `curl` strips the `Authorization` header on redirect.
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://www.greedypirate.com/api/cron/cleanup
   # → {"ok":true,"abandonedLobbies":0,"abandonedActive":0,"prunedEvents":0,...}
   ```

---

## Preview environment (separate Supabase project)

Run Steps 1–6 again for a second project (e.g. `greedy-pirate-preview`) so PR previews never touch prod data. Differences:

- Vercel env vars go on **Preview** scope only (use dashboard — see Step 4 note).
- `CRON_SECRET` on preview is unused (Vercel only schedules cron on production) but must be set or builds fail.
- `Site URL` in the preview project's Auth → URL Configuration can be left blank; add `https://*.vercel.app/**` and the project's auto-generated preview domain pattern to **Redirect URLs**.
- After both `drizzle-kit migrate` and `supabase db push`, re-link the CLI back to prod (`supabase link --project-ref <prod-ref>`) for any subsequent prod work.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `supabase start` hangs | Docker Desktop not running, or another container is using ports 54321/54322/54323. `npm run supabase:stop` then retry. |
| `Migration failed: CREATE TABLE "auth"."users"` | You regenerated migrations from scratch. Open the new migration, replace that statement with a comment. |
| Anonymous sign-in returns 422 | `enable_anonymous_sign_ins` is `false`. Local: edit `supabase/config.toml`. Cloud: Auth → Providers → Anonymous. |
| Phone shows the auth error overlay with a LAN hint | You started with `npm run dev` instead of `npm run dev:lan`. Stop, restart with `npm run dev:lan`, reload the phone. |
| Realtime "Live" dot stays amber on the play screen | Channel can't connect. Check the laptop's Supabase Realtime container is up (`docker ps | grep realtime`), and the `NEXT_PUBLIC_SUPABASE_URL` is reachable from the device. |
| RLS blocking writes | All writes go through server actions that use `DATABASE_URL` (service-role at the connection level). If you're using `getSupabaseServer()` for writes, switch to Drizzle via `db`. |
| `/api/cron/cleanup` returns 401 locally | Missing or wrong `CRON_SECRET`. Local default is `dev-cron-secret`. Send `Authorization: Bearer dev-cron-secret`. |
| Profile page is empty after first game | Check the `on_auth_user_created` trigger fired (Studio → Database → Triggers). If not, re-run `supabase db push --local`. |
| Dev server feels sluggish after days | Next.js HMR memory grows over time. Restart `npm run dev`. Not a code issue. |
| `Found invalid or discontinued Node.js Version: "18.x"` on Vercel build | Vercel disabled 18.x. Project Settings → General → Node.js Version → `24.x`. Redeploy. |
| `/api/cron/cleanup` returns 401 in prod despite Bearer header | You hit the apex domain. Apex 301-redirects to www and curl drops `Authorization` on redirect. Use `https://www.greedypirate.com` directly. |
| Drizzle migrate / Postgres connection rejects password | Password contains `$`, `&`, `*`, or `#` and was not URL-encoded. Encode and retry. |
| Docker Desktop UI unresponsive after days | Electron shell desyncs from the daemon. Quit Docker, `pkill -f com.docker.backend`, `pkill -f com.docker.virtualization`, `pkill -f com.docker.build`, then `open -a Docker`. Daemon helper `com.docker.vmnetd` (root-owned) stays — that is fine. |
| Anonymous sign-in returns "Anonymous sign-ins are disabled" in prod after toggling on | The toggle silently failed to persist. Reload the Auth → Providers page and re-toggle + Save. |
| Vercel preview deploys fail to build | Preview-scope env vars missing. Confirm 5 vars at `preview` scope in Project Settings → Environment Variables. |
