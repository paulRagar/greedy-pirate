import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { needsSessionRefresh } from '@/server/auth/sessionRoutes';

const AUTH_TIMEOUT_MS = 2500;

export async function middleware(request: NextRequest) {
   let response = NextResponse.next({ request });

   // Only auth-sensitive routes pay the cost of a session refresh. Public pages
   // (home, /rules, /play-local, etc.) never read the user, so skip the network
   // round-trip entirely. Downstream RSC pages and server actions re-verify the
   // JWT with their own getUser() call, so this cannot weaken auth.
   if (!needsSessionRefresh(request.nextUrl.pathname)) return response;

   const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
   const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
   if (!url || !anonKey) return response;

   const supabase = createServerClient(url, anonKey, {
      cookies: {
         getAll: () => request.cookies.getAll(),
         setAll: (toSet) => {
            response = NextResponse.next({ request });
            toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
         },
      },
   });

   // Refresh session if expired, but never let it block the page render for
   // longer than a couple seconds (Supabase reachability hiccups should not
   // hang every request).
   try {
      await Promise.race([
         supabase.auth.getUser(),
         new Promise((_, reject) => setTimeout(() => reject(new Error('auth-timeout')), AUTH_TIMEOUT_MS)),
      ]);
   } catch {
      // Swallow — the page will still render. Client-side AuthBootstrap will
      // surface a clearer error overlay if Supabase is genuinely unreachable.
   }

   return response;
}

export const config = {
   matcher: [
      // Run on app pages; skip static assets, the API tree, and well-known files.
      '/((?!_next/static|_next/image|api|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
   ],
};
