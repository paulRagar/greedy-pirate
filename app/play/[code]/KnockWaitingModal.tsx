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
};

export default function KnockWaitingModal({ code, kind, request, onResolved }: Props) {
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

   const open = !!request && status === 'pending';
   const title = kind === 'player' ? "Hailin' the Captain" : "Askin' to Watch";

   return (
      <PirateModal open={open} dismissible={false} title={title}>
         <div className='flex flex-col items-center gap-3 text-center'>
            <span className='text-5xl' aria-hidden>
               🏴‍☠️
            </span>
            <p className='text-sm text-[color:var(--color-cream-200)]/85'>
               Awaiting the captain&apos;s word. Their decision is incoming…
            </p>
            <div className='font-mono font-bold tabular-nums text-3xl text-[color:var(--color-gold-300)]'>
               {secondsLeft}s
            </div>
            <PirateButton variant='tertiary' size='md' fullWidth onClick={cancel}>
               Withdraw hail
            </PirateButton>
         </div>
      </PirateModal>
   );
}
