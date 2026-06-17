'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { emitProfileChanged } from '@/client/auth/useCurrentUser';
import { PirateButton } from '@/ui/pirate-button/PirateButton';

const MIN_PASSWORD = 8;

type State = 'waiting' | 'ready' | 'expired';

interface Props {
   /**
    * Server-side error pulled from `?error=` query params. We surface it
    * immediately. Hash-based `#error=` shows up at runtime via the
    * effect below.
    */
   initialError: string | null;
   /**
    * PKCE code from `?code=` query param. Exchanged client-side so the
    * resulting session is persisted in browser cookies (server
    * components can't write cookies). Null when the link arrived as
    * an implicit-flow hash instead.
    */
   code: string | null;
}

export function ResetPasswordForm({ initialError, code }: Props) {
   const router = useRouter();
   const [state, setState] = useState<State>(initialError ? 'expired' : 'waiting');
   const [errorMsg, setErrorMsg] = useState<string | null>(initialError);
   const [user, setUser] = useState<User | null>(null);

   const [password, setPassword] = useState('');
   const [confirm, setConfirm] = useState('');
   const [showPassword, setShowPassword] = useState(false);
   const [formError, setFormError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const [resending, setResending] = useState(false);
   const [resendInfo, setResendInfo] = useState<string | null>(null);

   useEffect(() => {
      if (state === 'expired') return;
      const supabase = getSupabaseBrowser();

      // Hash flow: Supabase puts an error fragment when the OTP is
      // expired or invalid. Surface it the same way the server-side
      // error path does.
      if (typeof window !== 'undefined' && window.location.hash.length > 1) {
         const params = new URLSearchParams(window.location.hash.slice(1));
         const hashError = params.get('error_description') ?? params.get('error');
         if (hashError) {
            setErrorMsg(decodeURIComponent(hashError.replace(/\+/g, ' ')));
            setState('expired');
            return;
         }
      }

      let active = true;

      const claim = async () => {
         // PKCE flow: exchange the code client-side. Server components
         // can't write cookies, so this MUST happen here — otherwise
         // the new session never reaches storage and the form's
         // updateUser call later runs against the stale anonymous
         // session.
         if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (!active) return;
            if (exchangeError) {
               setErrorMsg(exchangeError.message);
               setState('expired');
               return;
            }
         }

         const {
            data: { user: current },
         } = await supabase.auth.getUser();
         if (!active) return;
         // Anonymous users coming through home page auth don't count as
         // "recovered" — we wait for the real account session to land
         // via exchangeCodeForSession or the SDK's hash auto-detect.
         if (current && current.is_anonymous === false) {
            setUser(current);
            setState('ready');
         }
      };

      // PKCE flow: exchange runs above.
      // Implicit flow: SDK reads hash on init, fires PASSWORD_RECOVERY.
      void claim();

      const { data: sub } = supabase.auth.onAuthStateChange(
         (event: AuthChangeEvent, session: Session | null) => {
            if (!active) return;
            if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
               setUser(session?.user ?? null);
               setState('ready');
            }
         },
      );

      // If no session shows up within a few seconds, treat it as a
      // broken link rather than spinning forever.
      const timeout = window.setTimeout(() => {
         if (!active) return;
         setState((prev) => {
            if (prev === 'waiting') {
               setErrorMsg('Recovery link expired or invalid. Request a new one below.');
               return 'expired';
            }
            return prev;
         });
      }, 4000);

      return () => {
         active = false;
         sub.subscription.unsubscribe();
         window.clearTimeout(timeout);
      };
   }, [state, code]);

   const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);

      if (password.length < MIN_PASSWORD) {
         setFormError(`Password must be at least ${MIN_PASSWORD} characters`);
         return;
      }
      if (password !== confirm) {
         setFormError('Passwords do not match');
         return;
      }

      setSubmitting(true);
      const supabase = getSupabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      setSubmitting(false);
      if (updateError) {
         setFormError(updateError.message);
         return;
      }
      emitProfileChanged();
      router.push('/profile?auth=password-reset');
      router.refresh();
   };

   const resend = async () => {
      const email = user?.email ?? promptForEmail();
      if (!email) return;
      setResendInfo(null);
      setResending(true);
      const supabase = getSupabaseBrowser();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error: resendError } = await supabase.auth.resetPasswordForEmail(email, {
         redirectTo: `${origin}/auth/reset`,
      });
      setResending(false);
      if (resendError) {
         setErrorMsg(resendError.message);
         return;
      }
      setResendInfo(`Sent a fresh recovery link to ${email}.`);
   };

   if (state === 'expired') {
      return (
         <div className='flex flex-col gap-3'>
            <p className='text-sm text-[color:var(--color-coral-300)]'>
               {errorMsg ?? 'This recovery link is no longer valid.'}
            </p>
            <p className='text-sm text-[color:var(--color-cream-200)]/75'>
               Request a new link and try again. The latest one ye get is the only one that works — older links expire after the next is sent.
            </p>
            {resendInfo && (
               <p className='text-sm text-[color:var(--color-teal-300)]'>{resendInfo}</p>
            )}
            <PirateButton
               variant='primary'
               size='md'
               fullWidth
               onClick={resend}
               loading={resending}
            >
               Send a new link
            </PirateButton>
            <button
               type='button'
               onClick={() => router.push('/')}
               className='min-h-[44px] text-sm text-[color:var(--color-cream-200)]/60 underline-offset-4 hover:underline'
            >
               Back to home
            </button>
         </div>
      );
   }

   if (state === 'waiting') {
      return (
         <div className='flex items-center justify-center py-6'>
            <Spinner />
            <span className='ml-3 text-sm text-[color:var(--color-cream-200)]/70'>
               Hoisting the colors…
            </span>
         </div>
      );
   }

   return (
      <form onSubmit={submit} className='flex flex-col gap-3'>
         {user?.email && (
            <p className='text-sm text-[color:var(--color-cream-200)]/75'>
               Resetting password for{' '}
               <span className='font-mono text-[color:var(--color-gold-200)]'>{user.email}</span>.
            </p>
         )}

         <label className='flex flex-col gap-1 text-sm'>
            <span className='pirate-display text-xs uppercase tracking-wider text-[color:var(--color-cream-200)]/75'>
               New password
            </span>
            <input
               type={showPassword ? 'text' : 'password'}
               autoComplete='new-password'
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               placeholder={`At least ${MIN_PASSWORD} characters`}
               minLength={MIN_PASSWORD}
               className='input-pirate min-h-[48px] text-base'
               required
            />
         </label>

         <label className='flex flex-col gap-1 text-sm'>
            <span className='pirate-display text-xs uppercase tracking-wider text-[color:var(--color-cream-200)]/75'>
               Confirm new password
            </span>
            <input
               type={showPassword ? 'text' : 'password'}
               autoComplete='new-password'
               value={confirm}
               onChange={(e) => setConfirm(e.target.value)}
               minLength={MIN_PASSWORD}
               className='input-pirate min-h-[48px] text-base'
               required
            />
         </label>

         <button
            type='button'
            onClick={() => setShowPassword((s) => !s)}
            className='self-start text-xs font-semibold uppercase tracking-wider text-[color:var(--color-teal-300)] hover:text-[color:var(--color-teal-200)]'
         >
            {showPassword ? 'Hide password' : 'Show password'}
         </button>

         {formError && (
            <p className='text-sm text-[color:var(--color-coral-400)]'>{formError}</p>
         )}

         <PirateButton
            type='submit'
            variant='primary'
            size='md'
            fullWidth
            loading={submitting}
            disabled={!password || !confirm}
         >
            Set new password
         </PirateButton>
      </form>
   );
}

function promptForEmail(): string | null {
   if (typeof window === 'undefined') return null;
   const value = window.prompt('Enter the email tied to yer account:');
   if (!value) return null;
   const trimmed = value.trim().toLowerCase();
   if (!trimmed.includes('@')) return null;
   return trimmed;
}

function Spinner() {
   return (
      <svg
         viewBox='0 0 24 24'
         className='h-6 w-6 animate-spin text-[color:var(--color-gold-300)]'
         fill='none'
         aria-label='Loading'
      >
         <circle cx='12' cy='12' r='9' stroke='currentColor' strokeOpacity='0.25' strokeWidth='3' />
         <path d='M21 12a9 9 0 0 1-9 9' stroke='currentColor' strokeWidth='3' strokeLinecap='round' />
      </svg>
   );
}
