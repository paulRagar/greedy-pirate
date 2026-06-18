/**
 * Decides whether a request path needs a middleware-driven Supabase session
 * refresh (and JWT re-verification via `getUser`).
 *
 * Background: `getUser()` is a network round-trip to the Auth server. Running it
 * on *every* navigation (home, /rules, /play-local, marketing pages) adds latency
 * and a soft dependency on Auth-server uptime for pages that never read the user.
 *
 * Security: this is NOT an auth gate. The real enforcement lives downstream —
 * every protected RSC page and every server action calls `supabase.auth.getUser()`
 * itself, which re-verifies the JWT against the Auth server. Middleware only keeps
 * the cookie session fresh ahead of routes that will immediately read it, so the
 * downstream `getUser()` isn't refreshing an expired token mid-render. Narrowing
 * the set of routes that refresh here cannot weaken auth — it only skips the
 * refresh on pages that never consult the user.
 *
 * Auth-sensitive prefixes (refresh runs):
 *   /profile  — reads the user, shows stats / account controls
 *   /play     — online lobby + rooms read the user for seat / turn auth
 *               (covers /play/new, /play/join, /play/lobby, /play/[code])
 *   /admin    — admin-gated routes
 *   /auth     — recovery / callback flows that consume the session
 *   /setup    — display-name step that writes user-scoped data
 *
 * Everything else (`/`, `/rules`, `/choose-game`, `/play-local`) is public and
 * skips the refresh. Note `/play-local` is intentionally NOT under `/play`.
 */
const SESSION_ROUTE_PREFIXES = ['/profile', '/play', '/admin', '/auth', '/setup'] as const;

export function needsSessionRefresh(pathname: string): boolean {
   return SESSION_ROUTE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
   );
}
