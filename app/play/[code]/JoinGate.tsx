'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { joinRoom } from '@/server/actions/joinRoom';

export default function JoinGate({ code }: { code: string }) {
   const router = useRouter();
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);

   const join = async () => {
      setError(null);
      setSubmitting(true);
      const result = await joinRoom({ code });
      setSubmitting(false);
      if (result.ok) {
         router.refresh();
      } else {
         setError(result.error);
      }
   };

   return (
      <main className='flex flex-1 flex-col items-center justify-center gap-4 px-5 py-10 text-center'>
         <PiratePanel variant='deep' className='flex w-full max-w-sm flex-col items-center gap-3 teal-glow'>
            <span className='text-xs uppercase tracking-[0.3em] text-[color:var(--color-teal-400)]'>
               Boarding pass
            </span>
            <span className='wordmark-gold pirate-display text-5xl tracking-[0.45em] [text-indent:0.45em]'>
               {code}
            </span>
            <p className='text-sm text-[color:var(--color-cream-200)]/80'>
               Ready to board this voyage?
            </p>
            {error && <p className='text-sm text-[color:var(--color-coral-500)]'>{error}</p>}
            <PirateButton variant='primary' size='lg' fullWidth onClick={join} disabled={submitting}>
               {submitting ? 'Boarding…' : 'Board the ship'}
            </PirateButton>
         </PiratePanel>
      </main>
   );
}
