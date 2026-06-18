import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/server/supabase/server';
import { safeNextPath } from '@/lib/safeNext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Auth callback for Supabase email links:
 *   - email change confirmation
 *   - password recovery
 *   - email signup confirmation
 *
 * Supabase appends `?code=<pkce>` (and sometimes `?type=recovery|email_change|signup`)
 * to the redirect URL. We exchange the code for a session here, then
 * route the user to the appropriate next page.
 */
export async function GET(req: NextRequest) {
   const { searchParams, origin } = new URL(req.url);
   const code = searchParams.get('code');
   const type = searchParams.get('type');
   const next = searchParams.get('next');

   if (!code) {
      return NextResponse.redirect(`${origin}/profile?auth=missing-code`);
   }

   const supabase = await getSupabaseServer();
   const { error } = await supabase.auth.exchangeCodeForSession(code);
   if (error) {
      console.error('[auth/callback] exchange failed', error);
      return NextResponse.redirect(`${origin}/profile?auth=failed`);
   }

   // Password recovery links land here; the session is now scoped for a
   // password change. Bounce to /auth/reset which renders the form.
   if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/auth/reset`);
   }

   if (type === 'email_change') {
      return NextResponse.redirect(`${origin}/profile?auth=email-changed`);
   }

   return NextResponse.redirect(`${origin}${safeNextPath(next)}`);
}
