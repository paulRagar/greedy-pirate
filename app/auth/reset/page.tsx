import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { ResetPasswordForm } from './ResetPasswordForm';

export const dynamic = 'force-dynamic';

interface Props {
   searchParams: Promise<{ code?: string; error?: string; error_description?: string }>;
}

/**
 * Password recovery landing.
 *
 * The PKCE code exchange runs on the CLIENT, not here. Server Components
 * are read-only for cookies, so calling exchangeCodeForSession from this
 * file silently fails to persist the new session — the user keeps their
 * old anonymous cookies and updateUser later errors with "anonymous user
 * without an email". The client form handles all three entry shapes:
 *
 *   1. PKCE: ?code=... — client calls exchangeCodeForSession.
 *   2. Implicit: #access_token=...&type=recovery — SDK auto-detects.
 *   3. Error: ?error=... or #error=... — render expired-link UI.
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
            <ResetPasswordForm initialError={serverError} code={params.code ?? null} />
         </PiratePanel>
      </main>
   );
}
