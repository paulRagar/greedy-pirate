'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateModal } from '@/ui/pirate-modal/PirateModal';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { requestJoin } from '@/server/actions/requestJoin';
import KnockWaitingModal from './KnockWaitingModal';

type Pending = { requestId: string; expiresAt: string } | null;

export default function JoinGate({ code, isPublic }: { code: string; isPublic: boolean }) {
   const router = useRouter();
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const [pending, setPending] = useState<Pending>(null);
   const [deniedOpen, setDeniedOpen] = useState(false);
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

   // Private rooms skip the intermediate "Hail the Captain" button — we
   // fire the knock on mount so B sees the waiting modal immediately. Ref
   // guards against StrictMode double-invocation.
   useEffect(() => {
      if (isPublic) return;
      if (autoFired.current) return;
      autoFired.current = true;
      void board();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isPublic]);

   const cta = isPublic ? 'Board the ship' : 'Hail the Captain';
   const subtitle = isPublic
      ? 'Ready to board this voyage?'
      : 'Sealed hold — hailing the captain…';

   return (
      <main className='flex flex-1 flex-col items-center justify-center gap-4 px-5 py-10 text-center'>
         <PiratePanel
            variant='deep'
            className='flex w-full max-w-sm flex-col items-center gap-3 teal-glow'
         >
            <span className='text-xs uppercase tracking-[0.3em] text-[color:var(--color-teal-400)]'>
               Boarding pass
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
                  onClick={board}
                  disabled={submitting}
               >
                  {submitting ? 'Boarding…' : cta}
               </PirateButton>
            ) : (
               <p className='animate-pulse text-xs uppercase tracking-[0.3em] text-[color:var(--color-gold-300)]'>
                  Awaitin&apos; the captain&apos;s word
               </p>
            )}
            <Link href='/choose-game' className='w-full'>
               <PirateButton variant='tertiary' size='md' fullWidth>
                  Back to port
               </PirateButton>
            </Link>
         </PiratePanel>

         <KnockWaitingModal
            code={code}
            kind='player'
            request={pending}
            onResolved={(outcome) => {
               setPending(null);
               if (outcome === 'approved') {
                  router.refresh();
               } else if (outcome === 'denied') {
                  setDeniedOpen(true);
               } else if (outcome === 'expired') {
                  setError("No answer from the captain. Try hailin' again.");
               } else if (outcome === 'cancelled') {
                  // Knocker withdrew — stay on gate. They can navigate themselves.
               }
            }}
         />

         <PirateModal open={deniedOpen} dismissible={false} title='Refused boarding'>
            <div className='flex flex-col items-center gap-3 text-center'>
               <span className='text-5xl' aria-hidden>
                  🚫
               </span>
               <p className='text-sm text-[color:var(--color-cream-200)]/85'>
                  The captain has turned ye away from this voyage. Find another ship to plunder
                  with.
               </p>
               <PirateButton
                  variant='primary'
                  size='lg'
                  fullWidth
                  onClick={() => router.push('/choose-game')}
               >
                  Return to docks
               </PirateButton>
            </div>
         </PirateModal>
      </main>
   );
}
