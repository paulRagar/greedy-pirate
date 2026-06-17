'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { emitProfileChanged, useCurrentUser } from '@/client/auth/useCurrentUser';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';

const MIN_PASSWORD = 8;

type Mode = 'signup' | 'signin';

/**
 * Guest gate on the profile page. Three branches:
 *  1. Email confirmation pending → resend / cancel UI.
 *  2. Idle anonymous → sign up / sign in chooser.
 *  3. Form open → sign up or sign in form.
 */
export function AccountUpgrade() {
   const router = useRouter();
   const { user } = useCurrentUser();
   const pendingEmail = user?.new_email ?? null;

   const [open, setOpen] = useState(false);
   const [mode, setMode] = useState<Mode>('signup');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [info, setInfo] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const [resending, setResending] = useState(false);
   const [override, setOverride] = useState(false);

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
         // If email confirmation is required (prod default), is_anonymous
         // stays true until the user clicks the link. A DB trigger mirrors
         // that flag into public.users on confirmation; the avatar flips
         // automatically once the confirm callback redirects back.
         setPassword('');
         if (data.user && data.user.is_anonymous === false) {
            emitProfileChanged();
            router.refresh();
            setInfo('Account claimed!');
            return;
         }
         setInfo(`Check ${trimmed} for a confirmation link to finish claiming yer account.`);
         router.refresh();
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

   const resendConfirmation = async () => {
      if (!pendingEmail) return;
      setError(null);
      setInfo(null);
      setResending(true);
      const supabase = getSupabaseBrowser();
      const { error: resendError } = await supabase.auth.resend({
         type: 'email_change',
         email: pendingEmail,
      });
      setResending(false);
      if (resendError) {
         setError(resendError.message);
         return;
      }
      setInfo(`Sent another confirmation link to ${pendingEmail}.`);
   };

   if (pendingEmail && !override) {
      return (
         <PiratePanel variant='deep' className='flex flex-col gap-3'>
            <h2 className='pirate-display text-2xl text-[color:var(--color-gold-300)]'>Confirm yer email</h2>
            <p className='text-sm text-[color:var(--color-cream-200)]/80'>
               Click the link we sent to{' '}
               <span className='font-mono text-[color:var(--color-gold-200)]'>{pendingEmail}</span> to
               finish claiming yer account. Til then yer logbook stays sealed.
            </p>
            {error && <p className='text-sm text-[color:var(--color-coral-400)]'>{error}</p>}
            {info && <p className='text-sm text-[color:var(--color-teal-300)]'>{info}</p>}
            <PirateButton
               type='button'
               variant='primary'
               size='md'
               fullWidth
               onClick={resendConfirmation}
               disabled={resending}
            >
               {resending ? 'Sending…' : 'Resend confirmation'}
            </PirateButton>
            <button
               type='button'
               onClick={() => {
                  setError(null);
                  setInfo(null);
                  setOverride(true);
                  openAs('signup');
               }}
               className='min-h-[44px] text-sm text-[color:var(--color-coral-300)] underline-offset-4 hover:underline'
            >
               Use a different email
            </button>
         </PiratePanel>
      );
   }

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
