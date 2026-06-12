'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { emitProfileChanged } from '@/client/auth/useCurrentUser';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { markAccountClaimed } from '@/server/actions/markAccountClaimed';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';

const MIN_PASSWORD = 8;

type Mode = 'signup' | 'signin';

/**
 * Guest gate on the profile page: claim the current anonymous account
 * (sign up) or switch to an existing claimed account (sign in).
 */
export function AccountUpgrade() {
   const router = useRouter();
   const [open, setOpen] = useState(false);
   const [mode, setMode] = useState<Mode>('signup');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [info, setInfo] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);

   const openAs = (next: Mode) => {
      setMode(next);
      setOpen(true);
      setError(null);
      setInfo(null);
   };

   const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setInfo(null);

      const trimmed = email.trim().toLowerCase();
      if (!trimmed.includes('@')) {
         setError('Enter a valid email');
         return;
      }
      if (mode === 'signup' && password.length < MIN_PASSWORD) {
         setError(`Password must be at least ${MIN_PASSWORD} characters`);
         return;
      }

      setSubmitting(true);
      const supabase = getSupabaseBrowser();

      if (mode === 'signup') {
         // Claim the CURRENT anonymous account — history carries over.
         const { data, error: authError } = await supabase.auth.updateUser({
            email: trimmed,
            password,
         });
         setSubmitting(false);
         if (authError) {
            setError(authError.message);
            return;
         }
         if (data.user) {
            await markAccountClaimed();
            // Tell every useCurrentUser instance (TopNav avatar etc.) to refetch
            // — the server-side claim doesn't fire a browser auth event.
            emitProfileChanged();
            setInfo('Account claimed! Check yer inbox to confirm the email if Supabase asks for it.');
            setPassword('');
            router.refresh();
         }
         return;
      }

      // Sign in: replaces the anonymous session with the existing account.
      const { error: signInError } = await supabase.auth.signInWithPassword({
         email: trimmed,
         password,
      });
      setSubmitting(false);
      if (signInError) {
         setError(
            signInError.message === 'Invalid login credentials'
               ? 'No account matches that email and password.'
               : signInError.message,
         );
         return;
      }
      emitProfileChanged();
      setPassword('');
      router.refresh();
   };

   if (!open) {
      return (
         <PiratePanel variant='deep' className='flex flex-col gap-3'>
            <h2 className='pirate-display text-2xl text-[color:var(--color-gold-300)]'>Sign up to save yer logbook</h2>
            <p className='text-sm text-[color:var(--color-cream-200)]/80'>
               Stash yer doubloons forever. Add an email and a password, and yer logbook follows you to any device.
            </p>
            <PirateButton variant='primary' size='md' fullWidth onClick={() => openAs('signup')}>
               Sign up
            </PirateButton>
            <button
               type='button'
               onClick={() => openAs('signin')}
               className='min-h-[44px] text-sm text-[color:var(--color-teal-300)] underline-offset-4 hover:underline'
            >
               Already aboard? Sign in
            </button>
         </PiratePanel>
      );
   }

   const isSignup = mode === 'signup';

   return (
      <PiratePanel variant='deep' className='flex flex-col gap-3'>
         <div className='flex items-center justify-between gap-2'>
            <h2 className='pirate-display text-2xl text-[color:var(--color-gold-300)]'>
               {isSignup ? 'Sign up' : 'Sign in'}
            </h2>
            <button
               type='button'
               onClick={() => setOpen(false)}
               className='text-xs text-[color:var(--color-cream-200)]/60 underline-offset-4 hover:underline'
            >
               cancel
            </button>
         </div>

         <form onSubmit={submit} className='flex flex-col gap-3'>
            <label className='flex flex-col gap-1 text-sm'>
               <span className='pirate-display text-xs uppercase tracking-wider text-[color:var(--color-cream-200)]/75'>
                  Email
               </span>
               <input
                  type='email'
                  inputMode='email'
                  autoComplete='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='you@example.com'
                  className='input-pirate min-h-[48px] text-base'
               />
            </label>

            <label className='flex flex-col gap-1 text-sm'>
               <span className='pirate-display text-xs uppercase tracking-wider text-[color:var(--color-cream-200)]/75'>
                  Password
               </span>
               <input
                  type='password'
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={isSignup ? MIN_PASSWORD : undefined}
                  placeholder={isSignup ? `At least ${MIN_PASSWORD} characters` : 'Yer password'}
                  className='input-pirate min-h-[48px] text-base'
               />
            </label>

            {error && <p className='text-sm text-[color:var(--color-coral-400)]'>{error}</p>}
            {info && <p className='text-sm text-[color:var(--color-teal-300)]'>{info}</p>}

            <PirateButton
               type='submit'
               variant='primary'
               size='md'
               fullWidth
               disabled={
                  submitting || !email.trim() || (isSignup ? password.length < MIN_PASSWORD : password.length === 0)
               }
            >
               {submitting ? (isSignup ? 'Signing up…' : 'Signing in…') : isSignup ? 'Sign up' : 'Sign in'}
            </PirateButton>

            <button
               type='button'
               onClick={() => openAs(isSignup ? 'signin' : 'signup')}
               className='min-h-[44px] text-sm text-[color:var(--color-teal-300)] underline-offset-4 hover:underline'
            >
               {isSignup ? 'Already aboard? Sign in' : 'New crewmate? Sign up'}
            </button>
         </form>
      </PiratePanel>
   );
}
