/**
 * Validate a `next` redirect target from untrusted query input.
 *
 * Accepts only a same-origin absolute PATH: it must start with a single `/`
 * and must not be protocol-relative (`//host`) or backslash-tricked
 * (`/\host`, `/\/host`) — both of which browsers treat as off-site origins.
 * Anything else (absolute URLs, missing/empty values) falls back to `/profile`.
 */
export function safeNextPath(next: string | null | undefined): string {
   const fallback = '/profile';
   if (!next) return fallback;
   if (next[0] !== '/') return fallback;
   // Reject protocol-relative and backslash-escaped authority forms.
   if (next[1] === '/' || next[1] === '\\') return fallback;
   return next;
}
