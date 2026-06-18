'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateLinkButton } from '@/ui/pirate-button/PirateLinkButton';
import { PirateModal } from '@/ui/pirate-modal/PirateModal';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { requestJoin } from '@/server/actions/requestJoin';
import KnockWaitingModal from './KnockWaitingModal';

type Pending = { requestId: string; expiresAt: string } | null;

export default function SpectateGate({
   code,
   isPublic,
}: {
   code: string;
   isPublic: boolean;
}) {
   const router = useRouter();
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const [returning, startReturn] = useTransition();
   const [pending, setPending] = useState<Pending>(null);
   const [deniedOpen, setDeniedOpen] = useState(false);
   const autoFired = useRef(false);

   const watch = async () => {
      setError(null);
      setSubmitting(true);
      const result = await requestJoin({ code, kind: 'spectator' });
      setSubmitting(false);
      if (!result.ok) {
         setError(result.error);
         return;
      }
      if (result.status === 'pending') {
         setPending({ requestId: result.requestId, expiresAt: result.expiresAt });
         return;
      }
      router.refresh();
   };

   // Private rooms skip the intermediate button — fire the knock on mount.
   useEffect(() => {
      if (isPublic) return;
      if (autoFired.current) return;
      autoFired.current = true;
      void watch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isPublic]);

   const cta = isPublic ? 'Watch the voyage' : 'Hail the Captain';
   const subtitle = isPublic
      ? "The game has already begun. Watch as a spectator — ye'll be seated automatically when the captain calls for the next round."
      : 'Sealed hold — hailing the captain…';

   return (
      <main className='flex flex-1 flex-col items-center justify-center gap-4 px-5 py-10 text-center'>
         <PiratePanel
            variant='deep'
            className='flex w-full max-w-sm flex-col items-center gap-3 coral-glow'
         >
            <span className='text-4xl' aria-hidden>
               👁️
            </span>
            <span className='text-xs uppercase tracking-[0.3em] text-[color:var(--color-coral-400)]'>
               Voyage in progress
            </span>
            <span className='wordmark-gold-mono text-5xl tracking-[0.45em] [text-indent:0.45em]'>
               {code}
            </span>
            <p className='text-sm text-[color:var(--color-cream-200)]/80'>{subtitle}</p>
            {error && <p className='text-sm text-[color:var(--color-coral-500)]'>{error}</p>}
            {isPublic ? (
               <PirateButton
                  variant='primary'
                  size='lg'
                  fullWidth
                  onClick={watch}
                  loading={submitting}
               >
                  {cta}
               </PirateButton>
            ) : (
               <p className='animate-pulse text-xs uppercase tracking-[0.3em] text-[color:var(--color-gold-300)]'>
                  Awaitin&apos; the captain&apos;s word
               </p>
            )}
            <PirateLinkButton href='/choose-game' variant='tertiary' size='md' fullWidth>
               Back to port
            </PirateLinkButton>
         </PiratePanel>

         <KnockWaitingModal
            kind='spectator'
            request={pending}
            onResolved={(outcome) => {
               setPending(null);
               if (outcome === 'approved') {
                  router.refresh();
               } else if (outcome === 'denied') {
                  setDeniedOpen(true);
               } else if (outcome === 'expired') {
                  setError("No answer from the captain. Try hailin' again.");
               }
            }}
         />

         <PirateModal open={deniedOpen} dismissible={false} title='Refused boarding'>
            <div className='flex flex-col items-center gap-3 text-center'>
               <span className='text-5xl' aria-hidden>
                  🚫
               </span>
               <p className='text-sm text-[color:var(--color-cream-200)]/85'>
                  The captain has barred ye from watching this voyage. Find another deck to spy
                  from.
               </p>
               <PirateButton
                  variant='primary'
                  size='lg'
                  fullWidth
                  loading={returning}
                  onClick={() => startReturn(() => router.push('/choose-game'))}
               >
                  Return to docks
               </PirateButton>
            </div>
         </PirateModal>
      </main>
   );
}
