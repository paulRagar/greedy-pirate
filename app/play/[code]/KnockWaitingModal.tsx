'use client';

import { useEffect } from 'react';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateModal } from '@/ui/pirate-modal/PirateModal';
import { useKnockRequest, type KnockStatus } from '@/client/realtime/useKnockRequest';

type Props = {
   code: string;
   kind: 'player' | 'spectator';
   request: { requestId: string; expiresAt: string } | null;
   onResolved: (outcome: KnockStatus) => void;
   /**
    * When true, render the modal even before the server has returned a
    * pending request row. Lets the page open straight into "Hailin' the
    * captain" instead of flashing the empty boarding-pass screen first.
    */
   showPreliminary?: boolean;
};

export default function KnockWaitingModal({
   code,
   kind,
   request,
   onResolved,
   showPreliminary = false,
}: Props) {
   const { status, secondsLeft, cancel } = useKnockRequest({
      code,
      requestId: request?.requestId ?? null,
      expiresAt: request?.expiresAt ?? null,
   });

   useEffect(() => {
      if (!request) return;
      if (status === 'pending') return;
      onResolved(status);
   }, [status, request, onResolved]);

   const hasPending = !!request && status === 'pending';
   const open = hasPending || (showPreliminary && !request);
   const title = kind === 'player' ? "Hailin' the Captain" : "Askin' to Watch";

   const handleCancel = () => {
      if (hasPending) {
         void cancel();
      } else {
         // No pending row yet — synthesize a cancelled resolve so the
         // parent can route us out.
         onResolved('cancelled');
      }
   };

   return (
      <PirateModal open={open} dismissible={false} title={title}>
         <div className='flex flex-col items-center gap-3 text-center'>
            <span className='text-5xl' aria-hidden>
               🏴‍☠️
            </span>
            <p className='text-sm text-[color:var(--color-cream-200)]/85'>
               {hasPending
                  ? "Awaiting the captain's word. Their decision is incoming…"
                  : "Sendin' yer hail to the captain…"}
            </p>
            <div className='font-mono font-bold tabular-nums text-3xl text-[color:var(--color-gold-300)]'>
               {hasPending ? `${secondsLeft}s` : '—'}
            </div>
            <PirateButton variant='tertiary' size='md' fullWidth onClick={handleCancel}>
               Withdraw hail
            </PirateButton>
         </div>
      </PirateModal>
   );
}
