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

export default function JoinGate({ code, isPublic }: { code: string; isPublic: boolean }) {
   const router = useRouter();
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const [exiting, startExit] = useTransition();
   const [pending, setPending] = useState<Pending>(null);
   const [deniedOpen, setDeniedOpen] = useState(false);
   const [boarding, setBoarding] = useState(false);
   const autoFired = useRef(false);

   const board = async () => {
      setError(null);
      setSubmitting(true);
      const result = await requestJoin({ code, kind: 'player' });
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

   // Private rooms fire the knock on mount so the user lands straight
   // in the waiting modal. Ref guards against StrictMode's double-
   // invocation in dev.
   useEffect(() => {
      if (isPublic) return;
      if (autoFired.current) return;
      autoFired.current = true;
      void board();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isPublic]);

   const exitToPort = () => startExit(() => router.push('/choose-game'));

   // Private path — render the modal only. The auto-knock fires on
   // mount; until the server returns a pending row, show a "hailing"
   // state so the user never sees the underlying empty page.
   if (!isPublic) {
      return (
         <>
            <main className='flex flex-1' aria-label={`Hailing room ${code}`} />
            <KnockWaitingModal
               kind='player'
               request={pending}
               showPreliminary={!pending && !error && !boarding}
               boarding={boarding}
               onResolved={(outcome) => {
                  if (outcome === 'approved') {
                     // Keep the modal up in its "welcome aboard" state
                     // until the RSC refresh swaps us into the lobby —
                     // dropping pending without this would let the
                     // empty page show through for a beat.
                     setBoarding(true);
                     setPending(null);
                     router.refresh();
                     return;
                  }
                  setPending(null);
                  if (outcome === 'denied') {
                     setDeniedOpen(true);
                  } else if (outcome === 'expired') {
                     setError("No answer from the captain. Try hailin' again.");
                  } else if (outcome === 'cancelled') {
                     router.push('/choose-game');
                  }
               }}
            />
            <PirateModal open={deniedOpen} dismissible={false} title='Refused boarding'>
               <div className='flex flex-col items-center gap-3 text-center'>
                  <span className='text-5xl' aria-hidden>
                     🚫
                  </span>
                  <p className='text-sm text-[color:var(--color-cream-200)]/85'>
                     The captain has turned ye away from this voyage. Find another ship to plunder with.
                  </p>
                  <PirateButton variant='primary' size='lg' fullWidth loading={exiting} onClick={exitToPort}>
                     Return to docks
                  </PirateButton>
               </div>
            </PirateModal>
            {error && (
               <PirateModal open dismissible={false} title="Couldn't hail">
                  <div className='flex flex-col items-center gap-3 text-center'>
                     <p className='text-sm text-[color:var(--color-coral-500)]'>{error}</p>
                     <PirateButton variant='primary' size='md' fullWidth loading={exiting} onClick={exitToPort}>
                        Back to port
                     </PirateButton>
                  </div>
               </PirateModal>
            )}
         </>
      );
   }

   // Public path keeps the explicit boarding-pass affordance.
   return (
      <main className='flex flex-1 flex-col items-center justify-center gap-4 px-5 py-10 text-center'>
         <PiratePanel variant='deep' className='flex w-full max-w-sm flex-col items-center gap-3 teal-glow'>
            <span className='text-xs uppercase tracking-[0.3em] text-[color:var(--color-teal-400)]'>
               Boarding pass
            </span>
            <span className='wordmark-gold-mono text-5xl tracking-[0.45em] [text-indent:0.45em]'>{code}</span>
            <p className='text-sm text-[color:var(--color-cream-200)]/80'>Ready to board this voyage?</p>
            {error && <p className='text-sm text-[color:var(--color-coral-500)]'>{error}</p>}
            <PirateButton variant='primary' size='lg' fullWidth onClick={board} loading={submitting}>
               Board the ship
            </PirateButton>
            <PirateLinkButton href='/choose-game' variant='tertiary' size='md' fullWidth>
               Back to port
            </PirateLinkButton>
         </PiratePanel>
      </main>
   );
}
