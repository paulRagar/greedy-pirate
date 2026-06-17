'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const RESET_PATH = '/auth/reset';

/**
 * Catches Supabase recovery redirects that land somewhere other than
 * /auth/reset and reroutes them. Two cases:
 *
 *  1. Successful implicit-flow recovery: Supabase appends
 *     #access_token=...&type=recovery to the redirect_to URL. If the
 *     redirect_to bounces to Site URL (e.g. PKCE verifier missing), the
 *     hash lands on `/`. We forward it to /auth/reset, preserving the
 *     hash so getSupabaseBrowser()'s detectSessionInUrl can claim the
 *     session there.
 *
 *  2. Expired / invalid recovery link: Supabase appends
 *     #error=access_denied&error_code=otp_expired&... — again to
 *     redirect_to OR Site URL. /auth/reset renders a "link expired"
 *     panel with a way to request a fresh link.
 *
 * Mounted at the layout level so it runs no matter which page the user
 * lands on.
 */
export function RecoveryHashRouter() {
   const pathname = usePathname();

   useEffect(() => {
      if (typeof window === 'undefined') return;
      if (pathname === RESET_PATH) return;
      const hash = window.location.hash;
      if (!hash || hash.length < 2) return;

      const params = new URLSearchParams(hash.slice(1));
      const isRecovery = params.get('type') === 'recovery';
      const isAuthError = params.get('error_code')?.startsWith('otp_') ?? false;
      if (!isRecovery && !isAuthError) return;

      // Hard navigation so window.location.hash is preserved on the
      // landing page — Next.js client routing can drop it during
      // server-rendered transitions. The Supabase SDK on /auth/reset
      // reads the hash via detectSessionInUrl to claim the recovery
      // session.
      window.location.replace(`${RESET_PATH}${hash}`);
   }, [pathname]);

   return null;
}
