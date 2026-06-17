'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const RESET_PATH = '/auth/reset';

/**
 * Catches Supabase recovery redirects that land somewhere other than
 * /auth/reset and reroutes them. Three fallback shapes to handle:
 *
 *  1. Hash recovery: Supabase appends
 *     #access_token=...&type=recovery to the redirect_to URL when the
 *     PKCE verifier is missing. If redirect_to bounces to Site URL
 *     (allowlist mismatch), the hash lands on `/`.
 *
 *  2. Hash error: #error=access_denied&error_code=otp_expired&... —
 *     again on whichever URL the validator fell back to.
 *
 *  3. Query-string PKCE: Supabase appends ?code=<pkce> to whatever
 *     URL it ends up redirecting to. If that's Site URL instead of
 *     /auth/reset, the code lands on `/` and the home page has no
 *     handler. The validator rejects redirect_to URLs whose host
 *     doesn't exactly match the allowlist (e.g. www vs apex), so this
 *     case shows up in the wild even when our app code is correct.
 *
 * Mounted at the layout level so it runs no matter which page the
 * user lands on. Hard navigation (window.location) preserves the
 * hash through the transition — Next.js client routing can drop it.
 */
export function RecoveryHashRouter() {
   const pathname = usePathname();

   useEffect(() => {
      if (typeof window === 'undefined') return;
      if (pathname === RESET_PATH) return;

      const hash = window.location.hash;
      if (hash.length > 1) {
         const params = new URLSearchParams(hash.slice(1));
         const isRecovery = params.get('type') === 'recovery';
         const isAuthError = params.get('error_code')?.startsWith('otp_') ?? false;
         if (isRecovery || isAuthError) {
            window.location.replace(`${RESET_PATH}${hash}`);
            return;
         }
      }

      // ?code= on the root means Supabase fell back to Site URL after
      // rejecting the redirect_to we asked for. Forward it to
      // /auth/reset, which knows how to exchange the code. We only
      // intercept on `/` to avoid trampling other PKCE flows that
      // legitimately land on /auth/callback.
      // Reading window.location.search directly (instead of
      // useSearchParams) keeps this layout-mounted component from
      // forcing every page in the app into dynamic rendering.
      if (pathname === '/') {
         const code = new URLSearchParams(window.location.search).get('code');
         if (code) {
            window.location.replace(`${RESET_PATH}?code=${encodeURIComponent(code)}`);
         }
      }
   }, [pathname]);

   return null;
}
