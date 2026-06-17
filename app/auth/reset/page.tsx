import { getSupabaseServer } from '@/server/supabase/server';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { ResetPasswordForm } from './ResetPasswordForm';

export const dynamic = 'force-dynamic';

interface Props {
   searchParams: Promise<{ code?: string; error?: string; error_description?: string }>;
}

/**
 * Password recovery landing.
 *
 * Three entry shapes Supabase may produce:
 *
 *  1. PKCE flow — `?code=<pkce>`: we exchange server-side and the session
 *     lands in cookies before the form renders.
 *  2. Implicit flow — `#access_token=...&type=recovery`: the hash never
 *     reaches the server. We render the form regardless; the client SDK
 *     auto-detects the hash on mount and the form waits for a session.
 *  3. Error — `?error=...` or `#error=...`: render an "expired link"
 *     panel with a button to request a fresh recovery email.
 */
export default async function ResetPasswordPage({ searchParams }: Props) {
   const params = await searchParams;
   const supabase = await getSupabaseServer();

   // Surface query-string errors immediately (only the `?error=` shape;
   // hash errors are caught client-side in the form).
   const serverError = params.error
      ? params.error_description ?? params.error
      : null;

   // PKCE: exchange before rendering so the form sees a session.
   if (params.code && !serverError) {
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (error) {
         return <ResetShell error={error.message} />;
      }
   }

   return <ResetShell error={serverError} />;
}

function ResetShell({ error }: { error: string | null }) {
   return (
      <main className='mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-10'>
         <header className='text-center'>
            <h1 className='pirate-display text-3xl text-[color:var(--color-gold-300)] sm:text-4xl'>
               Set a new password
            </h1>
            <p className='mt-2 text-sm text-[color:var(--color-cream-200)]/75'>
               Pick a fresh password to unlock yer logbook.
            </p>
         </header>
         <PiratePanel variant='deep' className='flex flex-col gap-4'>
            <ResetPasswordForm initialError={error} />
         </PiratePanel>
      </main>
   );
}
