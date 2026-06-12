'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { joinAsSpectator } from '@/server/actions/spectatorActions';

export default function SpectateGate({ code }: { code: string }) {
   const router = useRouter();
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);

   const watch = async () => {
      setError(null);
      setSubmitting(true);
      const result = await joinAsSpectator({ code });
      setSubmitting(false);
      if (result.ok) {
         router.refresh();
      } else {
         setError(result.error);
      }
   };

   return (
      <main className='flex flex-1 flex-col items-center justify-center gap-4 px-5 py-10 text-center'>
         <PiratePanel variant='deep' className='flex w-full max-w-sm flex-col items-center gap-3 coral-glow'>
            <span className='text-4xl' aria-hidden>👁️</span>
            <span className='text-xs uppercase tracking-[0.3em] text-[color:var(--color-coral-400)]'>
               Voyage in progress
            </span>
            <span className='wordmark-gold pirate-display text-5xl tracking-[0.45em] [text-indent:0.45em]'>
               {code}
            </span>
            <p className='text-sm text-[color:var(--color-cream-200)]/80'>
               The game has already begun. Watch as a spectator — you&apos;ll be seated automatically when the captain
               calls for the next round.
            </p>
            {error && <p className='text-sm text-[color:var(--color-coral-500)]'>{error}</p>}
            <PirateButton variant='primary' size='lg' fullWidth onClick={watch} disabled={submitting}>
               {submitting ? 'Climbing aboard…' : 'Watch the voyage'}
            </PirateButton>
            <Link href='/choose-game' className='w-full'>
               <PirateButton variant='tertiary' size='md' fullWidth>
                  Back to port
               </PirateButton>
            </Link>
         </PiratePanel>
      </main>
   );
}
