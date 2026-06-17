import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/server/supabase/server';
import { ResetPasswordForm } from './ResetPasswordForm';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage() {
   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();

   // Recovery link lands here via /auth/callback?type=recovery, which
   // exchanges the PKCE code and gives us a recovery-scoped session.
   // Without that session there is nothing to do here — punt to home.
   if (!user) redirect('/');

   return (
      <main className='mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10 text-[color:var(--color-cream-200)]'>
         <header>
            <h1 className='font-display text-3xl uppercase tracking-wider text-[color:var(--color-gold-200)]'>
               Set a new password
            </h1>
            <p className='mt-2 text-sm opacity-75'>
               Resetting for <span className='font-mono'>{user.email}</span>.
            </p>
         </header>
         <ResetPasswordForm />
      </main>
   );
}
