'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { PirateButton } from '@/ui/pirate-button/PirateButton';

const MIN_PASSWORD = 8;

export function ResetPasswordForm() {
   const router = useRouter();
   const [password, setPassword] = useState('');
   const [confirm, setConfirm] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);

   const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (password.length < MIN_PASSWORD) {
         setError(`Password must be at least ${MIN_PASSWORD} characters`);
         return;
      }
      if (password !== confirm) {
         setError('Passwords do not match');
         return;
      }

      setSubmitting(true);
      const supabase = getSupabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      setSubmitting(false);
      if (updateError) {
         setError(updateError.message);
         return;
      }
      router.push('/profile?auth=password-reset');
      router.refresh();
   };

   return (
      <form onSubmit={submit} className='flex flex-col gap-3'>
         <label className='flex flex-col gap-1 text-sm'>
            New password
            <input
               type='password'
               autoComplete='new-password'
               value={password}
               onChange={(e) => setPassword(e.target.value)}
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
         <PirateButton type='submit' loading={submitting} fullWidth>
            Set new password
         </PirateButton>
      </form>
   );
}
