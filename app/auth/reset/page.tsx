import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { ResetPasswordForm } from './ResetPasswordForm';

export const dynamic = 'force-dynamic';

interface Props {
   searchParams: Promise<{ error?: string; error_description?: string }>;
}

/**
 * Password recovery landing.
 *
 * The PKCE exchange is done by /auth/callback (a Route Handler that
 * can read the HttpOnly verifier cookie and write the new session
 * cookies). By the time we render here, the recovered session is
 * already in storage. We just hand off to the client form, which
 * verifies the session and lets the user set a new password.
 *
 * Implicit flow is still supported: if the redirect arrived with
 * `#access_token=...&type=recovery` (no `?code=`), the Supabase SDK
 * auto-detects the hash on mount and fires PASSWORD_RECOVERY.
 */
export default async function ResetPasswordPage({ searchParams }: Props) {
   const params = await searchParams;

   const serverError = params.error ? params.error_description ?? params.error : null;

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
            <ResetPasswordForm initialError={serverError} />
         </PiratePanel>
      </main>
   );
}
