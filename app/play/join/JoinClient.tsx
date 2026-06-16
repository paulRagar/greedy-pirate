'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { useCurrentUser } from '@/client/auth/useCurrentUser';

export default function JoinClient() {
   const router = useRouter();
   const { ready } = useCurrentUser();
   const [code, setCode] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);

   if (!ready) {
      return (
         <main className='flex flex-1 flex-col items-center justify-center gap-3 px-5 py-10 text-center'>
            <p className='pirate-display animate-pulse text-2xl text-[color:var(--color-gold-300)]'>
               Hoisting the colors…
            </p>
         </main>
      );
   }

   const submit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = code.trim().toUpperCase();
      if (trimmed.length !== 4) {
         setError('Room codes are 4 characters');
         return;
      }
      setError(null);
      setSubmitting(true);
      // Don't try to join here — route to the room page and let JoinGate /
      // SpectateGate decide between direct-board (public) and knock (private).
      // The page handles not-found and visibility-gated paths.
      router.push(`/play/${trimmed}`);
   };

   return (
      <main className='scrollbar-none flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-6 safe-bottom sm:py-10'>
         <header className='flex flex-col gap-1 text-center'>
            <h1 className='wordmark-gold pirate-display text-5xl sm:text-6xl'>Board a Ship</h1>
            <p className='text-sm text-[color:var(--color-cream-200)]/75'>
               Punch in the four-letter room code yer captain sent.
            </p>
         </header>

         <PiratePanel variant='deep'>
            <form onSubmit={submit} className='flex flex-col gap-3'>
               <label htmlFor='room-code' className='text-sm font-semibold uppercase tracking-wider'>
                  Room code
               </label>
               <input
                  id='room-code'
                  type='text'
                  inputMode='text'
                  autoComplete='off'
                  autoCapitalize='characters'
                  spellCheck={false}
                  maxLength={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder='ABCD'
                  className='input-pirate min-h-[68px] text-center text-4xl font-mono font-bold tracking-[0.5em] !text-[color:var(--color-gold-300)] [text-indent:0.5em]'
               />
               {error && <p className='text-sm text-[color:var(--color-coral-500)]'>{error}</p>}
               <PirateButton
                  variant='primary'
                  size='lg'
                  fullWidth
                  type='submit'
                  disabled={submitting || code.trim().length !== 4}
               >
                  {submitting ? 'Boarding…' : 'Board the ship'}
               </PirateButton>
            </form>
         </PiratePanel>
      </main>
   );
}
