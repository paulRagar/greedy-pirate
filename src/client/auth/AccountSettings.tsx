'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { emitProfileChanged } from '@/client/auth/useCurrentUser';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';

const MIN_PASSWORD = 8;

interface Props {
   currentEmail: string;
}

/**
 * Account settings panels on /profile for claimed (non-anon) users.
 *  - Change email: reauth with current password, then updateUser({email}).
 *    Supabase sends a confirmation link to the new address (and the old
 *    one if "Secure email change" is enabled). The link routes through
 *    /auth/callback which exchanges the PKCE code; our sync_user_email
 *    trigger then mirrors the new address into public.users.
 *  - Change password: reauth with current password, then updateUser({password}).
 *    Update takes effect immediately, no email round-trip.
 */
export function AccountSettings({ currentEmail }: Props) {
   return (
      <section className='flex flex-col gap-4'>
         <h2 className='pirate-display text-2xl text-[color:var(--color-gold-200)]'>
            Account settings
         </h2>
         <ChangeEmailPanel currentEmail={currentEmail} />
         <ChangePasswordPanel currentEmail={currentEmail} />
      </section>
   );
}

function ChangeEmailPanel({ currentEmail }: { currentEmail: string }) {
   const router = useRouter();
   const [open, setOpen] = useState(false);
   const [password, setPassword] = useState('');
   const [newEmail, setNewEmail] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [info, setInfo] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);

   const reset = () => {
      setPassword('');
      setNewEmail('');
      setError(null);
      setInfo(null);
   };

   const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setInfo(null);

      const trimmed = newEmail.trim().toLowerCase();
      if (!trimmed.includes('@')) {
         setError('Enter a valid email');
         return;
      }
      if (trimmed === currentEmail.toLowerCase()) {
         setError('That is already your email');
         return;
      }

      setSubmitting(true);
      const supabase = getSupabaseBrowser();

      // Reauth — proves the caller knows the current password before we
      // mutate identity. Without this step, a hijacked session could
      // silently steal the account by changing the email.
      const reauth = await supabase.auth.signInWithPassword({
         email: currentEmail,
         password,
      });
      if (reauth.error) {
         setSubmitting(false);
         setError('Current password is incorrect');
         return;
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error: updateError } = await supabase.auth.updateUser(
         { email: trimmed },
         { emailRedirectTo: `${origin}/auth/callback?type=email_change` },
      );
      setSubmitting(false);

      if (updateError) {
         setError(updateError.message);
         return;
      }

      setInfo(
         `Confirmation link sent to ${trimmed}. The change takes effect after you click it (and the link sent to your current address, if double-confirm is on).`,
      );
      setPassword('');
      setNewEmail('');
      router.refresh();
   };

   return (
      <PiratePanel variant='deep' className='flex flex-col gap-3 p-4'>
         <div className='flex items-center justify-between gap-3'>
            <div className='min-w-0'>
               <h3 className='text-sm font-semibold uppercase tracking-wider text-[color:var(--color-cream-200)]/80'>
                  Email
               </h3>
               <p className='truncate font-mono text-base'>{currentEmail}</p>
            </div>
            <PirateButton
               variant='tertiary'
               size='sm'
               onClick={() => {
                  if (open) reset();
                  setOpen((o) => !o);
               }}
            >
               {open ? 'Cancel' : 'Change'}
            </PirateButton>
         </div>
         {open && (
            <form onSubmit={submit} className='flex flex-col gap-3 border-t border-white/10 pt-3'>
               <label className='flex flex-col gap-1 text-sm'>
                  Current password
                  <input
                     type='password'
                     autoComplete='current-password'
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className='min-h-[44px] rounded-md border border-white/15 bg-black/30 px-3 text-base'
                     required
                  />
               </label>
               <label className='flex flex-col gap-1 text-sm'>
                  New email
                  <input
                     type='email'
                     autoComplete='email'
                     value={newEmail}
                     onChange={(e) => setNewEmail(e.target.value)}
                     className='min-h-[44px] rounded-md border border-white/15 bg-black/30 px-3 text-base'
                     required
                  />
               </label>
               {error && (
                  <p className='text-sm text-[color:var(--color-coral-300)]'>{error}</p>
               )}
               {info && (
                  <p className='text-sm text-[color:var(--color-teal-200)]'>{info}</p>
               )}
               <PirateButton type='submit' loading={submitting} fullWidth size='sm'>
                  Send confirmation email
               </PirateButton>
            </form>
         )}
      </PiratePanel>
   );
}

function ChangePasswordPanel({ currentEmail }: { currentEmail: string }) {
   const [open, setOpen] = useState(false);
   const [current, setCurrent] = useState('');
   const [next, setNext] = useState('');
   const [confirm, setConfirm] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [info, setInfo] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);

   const reset = () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      setError(null);
      setInfo(null);
   };

   const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setInfo(null);

      if (next.length < MIN_PASSWORD) {
         setError(`Password must be at least ${MIN_PASSWORD} characters`);
         return;
      }
      if (next !== confirm) {
         setError('New passwords do not match');
         return;
      }
      if (next === current) {
         setError('New password must be different');
         return;
      }

      setSubmitting(true);
      const supabase = getSupabaseBrowser();
      const reauth = await supabase.auth.signInWithPassword({
         email: currentEmail,
         password: current,
      });
      if (reauth.error) {
         setSubmitting(false);
         setError('Current password is incorrect');
         return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      setSubmitting(false);
      if (updateError) {
         setError(updateError.message);
         return;
      }

      setInfo('Password updated.');
      emitProfileChanged();
      reset();
      setOpen(false);
   };

   return (
      <PiratePanel variant='deep' className='flex flex-col gap-3 p-4'>
         <div className='flex items-center justify-between gap-3'>
            <div className='min-w-0'>
               <h3 className='text-sm font-semibold uppercase tracking-wider text-[color:var(--color-cream-200)]/80'>
                  Password
               </h3>
               <p className='text-sm text-[color:var(--color-cream-200)]/55'>
                  Change your sign-in password.
               </p>
            </div>
            <PirateButton
               variant='tertiary'
               size='sm'
               onClick={() => {
                  if (open) reset();
                  setOpen((o) => !o);
               }}
            >
               {open ? 'Cancel' : 'Change'}
            </PirateButton>
         </div>
         {!open && info && (
            <p className='border-t border-white/10 pt-3 text-sm text-[color:var(--color-teal-200)]'>
               {info}
            </p>
         )}
         {open && (
            <form onSubmit={submit} className='flex flex-col gap-3 border-t border-white/10 pt-3'>
               <label className='flex flex-col gap-1 text-sm'>
                  Current password
                  <input
                     type='password'
                     autoComplete='current-password'
                     value={current}
                     onChange={(e) => setCurrent(e.target.value)}
                     className='min-h-[44px] rounded-md border border-white/15 bg-black/30 px-3 text-base'
                     required
                  />
               </label>
               <label className='flex flex-col gap-1 text-sm'>
                  New password
                  <input
                     type='password'
                     autoComplete='new-password'
                     value={next}
                     onChange={(e) => setNext(e.target.value)}
                     className='min-h-[44px] rounded-md border border-white/15 bg-black/30 px-3 text-base'
                     required
                  />
               </label>
               <label className='flex flex-col gap-1 text-sm'>
                  Confirm new password
                  <input
                     type='password'
                     autoComplete='new-password'
                     value={confirm}
                     onChange={(e) => setConfirm(e.target.value)}
                     className='min-h-[44px] rounded-md border border-white/15 bg-black/30 px-3 text-base'
                     required
                  />
               </label>
               {error && (
                  <p className='text-sm text-[color:var(--color-coral-300)]'>{error}</p>
               )}
               <PirateButton type='submit' loading={submitting} fullWidth size='sm'>
                  Update password
               </PirateButton>
            </form>
         )}
      </PiratePanel>
   );
}
