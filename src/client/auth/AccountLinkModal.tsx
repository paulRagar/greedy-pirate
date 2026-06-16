'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { markAccountClaimed } from '@/server/actions/markAccountClaimed';
import { prepareSeatTransfer, claimSeatByToken } from '@/server/actions/seatTransfer';
import { emitProfileChanged } from '@/client/auth/useCurrentUser';
import { SKIP_LEAVE_BEACON_KEY } from '@/lib/leaveBeacon';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateModal } from '@/ui/pirate-modal/PirateModal';
import { cn } from '@/lib/cn';

const MIN_PASSWORD = 8;

type Mode = 'signup' | 'signin';

interface Props {
   open: boolean;
   onClose: () => void;
   initialMode?: Mode;
}

/**
 * In-place sign up / sign in. Unlike the profile-page upgrade panel,
 * this modal stays in the current route — useful when a user wants to
 * claim or switch accounts mid-lobby without losing their seat.
 *
 * Seat preservation: if the caller is currently seated in a room, we
 * mint a one-time transfer token BEFORE switching identities and redeem
 * it AFTER. The seat gets rewritten to the new user id; no re-knock.
 */
export function AccountLinkModal({ open, onClose, initialMode = 'signup' }: Props) {
   const router = useRouter();
   const params = useParams();
   const roomCode = typeof params?.code === 'string' ? params.code.toUpperCase() : null;

   const [mode, setMode] = useState<Mode>(initialMode);
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [info, setInfo] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);

   useEffect(() => {
      if (open) {
         setMode(initialMode);
         setEmail('');
         setPassword('');
         setError(null);
         setInfo(null);
         setSubmitting(false);
      }
   }, [open, initialMode]);

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

      // For sign-in only: mint a transfer token while we still hold the
      // anon session, so we can claim our seat back under the new id.
      let transferToken: string | null = null;
      if (mode === 'signin' && roomCode) {
         const res = await prepareSeatTransfer({ code: roomCode });
         if (res.ok) transferToken = res.token;
      }

      if (mode === 'signup') {
         const { data, error: authError } = await supabase.auth.updateUser({
            email: trimmed,
            password,
         });
         if (authError) {
            setSubmitting(false);
            setError(authError.message);
            return;
         }
         if (data.user) {
            await markAccountClaimed();
            emitProfileChanged();
            router.refresh();
            onClose();
         }
         setSubmitting(false);
         return;
      }

      // Sign in — replaces the anonymous session entirely.
      const { error: signInError } = await supabase.auth.signInWithPassword({
         email: trimmed,
         password,
      });
      if (signInError) {
         setSubmitting(false);
         setError(
            signInError.message === 'Invalid login credentials'
               ? 'No account matches that email and password.'
               : signInError.message,
         );
         return;
      }

      // Redeem the seat we held under the anon id, if we had one.
      let claimError: string | null = null;
      if (transferToken) {
         const claim = await claimSeatByToken({ token: transferToken });
         if (!claim.ok) claimError = claim.error;
      }

      emitProfileChanged();

      if (claimError) {
         // Non-fatal: signed in, just lost the seat. Surface a hint so
         // the user knows they may need to re-board.
         setInfo(`Signed in, but couldn't keep yer seat: ${claimError}`);
         router.refresh();
         setSubmitting(false);
         return;
      }

      // If we transferred a seat, a full reload is the cleanest way to
      // re-bind realtime presence + RSC state under the new identity in
      // one shot. Without it the lobby races: userId switches before the
      // broadcast lands, the plank-detection heuristic mistakes the
      // transition for being kicked, and a "walked the plank" modal
      // pops up over the real lobby.
      //
      // BUT: Supabase writes the auth cookie via an async setAll
      // callback; reloading too fast sends stale cookies and the
      // server treats us as anonymous again. Confirm the session is
      // current before reloading.
      if (transferToken) {
         for (let i = 0; i < 20; i++) {
            const { data } = await supabase.auth.getSession();
            if (data.session?.user?.id) break;
            await new Promise((r) => setTimeout(r, 50));
         }
         // Stop the unload handler from deleting our just-transferred
         // seat as the reload tears down the room page.
         try {
            sessionStorage.setItem(SKIP_LEAVE_BEACON_KEY, '1');
         } catch {
            // private mode: worst case is we re-knock after reload
         }
         window.location.reload();
         return;
      }

      router.refresh();
      setSubmitting(false);
      onClose();
   };

   const isSignup = mode === 'signup';

   return (
      <PirateModal open={open} onClose={onClose} dismissible title={isSignup ? 'Sign up' : 'Sign in'}>
         <div className='flex gap-2'>
            <button
               type='button'
               data-testid='auth-tab-signup'
               onClick={() => setMode('signup')}
               className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                  isSignup
                     ? 'border-[color:var(--color-gold-400)] bg-[color:var(--color-deep-700)]/70 text-[color:var(--color-gold-300)]'
                     : 'border-[color:var(--color-surface-border)] bg-[color:var(--color-abyss-900)]/40 text-[color:var(--color-cream-200)]/70 hover:border-[color:var(--color-gold-500)]/50',
               )}
            >
               Sign up
            </button>
            <button
               type='button'
               data-testid='auth-tab-signin'
               onClick={() => setMode('signin')}
               className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                  !isSignup
                     ? 'border-[color:var(--color-gold-400)] bg-[color:var(--color-deep-700)]/70 text-[color:var(--color-gold-300)]'
                     : 'border-[color:var(--color-surface-border)] bg-[color:var(--color-abyss-900)]/40 text-[color:var(--color-cream-200)]/70 hover:border-[color:var(--color-gold-500)]/50',
               )}
            >
               Sign in
            </button>
         </div>

         <p className='text-xs text-[color:var(--color-cream-200)]/60'>
            {isSignup
               ? 'Add an email + password to save yer logbook to this device.'
               : 'Switch to a crewmate that already has an account.'}
         </p>

         <form onSubmit={submit} className='flex flex-col gap-3'>
            <label className='flex flex-col gap-1 text-sm'>
               <span className='pirate-display text-xs uppercase tracking-wider text-[color:var(--color-cream-200)]/75'>
                  Email
               </span>
               <input
                  type='email'
                  data-testid='auth-email'
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
                  data-testid='auth-password'
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

            <div className='flex gap-2'>
               <PirateButton variant='ghost' size='md' fullWidth type='button' onClick={onClose}>
                  Cancel
               </PirateButton>
               <PirateButton
                  type='submit'
                  data-testid='auth-submit'
                  variant='primary'
                  size='md'
                  fullWidth
                  disabled={
                     submitting ||
                     !email.trim() ||
                     (isSignup ? password.length < MIN_PASSWORD : password.length === 0)
                  }
               >
                  {submitting ? (isSignup ? 'Signing up…' : 'Signing in…') : isSignup ? 'Sign up' : 'Sign in'}
               </PirateButton>
            </div>
         </form>
      </PirateModal>
   );
}
