'use client';

import { useState } from 'react';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateModal } from '@/ui/pirate-modal/PirateModal';
import { kickPlayer } from '@/server/actions/kickPlayer';
import { passTheWheel } from '@/server/actions/passTheWheel';

type Step = 'pick' | 'confirm-wheel' | 'confirm-kick';

type Props = {
   code: string;
   targetUserId: string;
   targetName: string;
   /** Lobby = full moderation. Active = pass-wheel only. */
   roomStatus: 'lobby' | 'active' | 'complete';
};

/**
 * Captain's dropdown — appears on each non-host player's seat card. Two
 * actions, each gated by an in-modal confirmation step. Replaces the
 * separate Crew Controls strip and the browser confirm/alert dialogs.
 */
export default function CaptainMenu({ code, targetUserId, targetName, roomStatus }: Props) {
   const [step, setStep] = useState<Step | null>(null);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const canKick = roomStatus === 'lobby';
   const canPass = roomStatus === 'lobby' || roomStatus === 'active';
   if (!canKick && !canPass) return null;

   const close = () => {
      if (busy) return;
      setStep(null);
      setError(null);
   };

   const doPass = async () => {
      setBusy(true);
      setError(null);
      const res = await passTheWheel({ code, toUserId: targetUserId });
      setBusy(false);
      if (!res.ok) {
         setError(res.error);
         return;
      }
      setStep(null);
   };

   const doKick = async () => {
      setBusy(true);
      setError(null);
      const res = await kickPlayer({ code, userId: targetUserId });
      setBusy(false);
      if (!res.ok) {
         setError(res.error);
         return;
      }
      setStep(null);
   };

   return (
      <>
         <button
            type='button'
            onClick={() => setStep('pick')}
            aria-label={`Captain's orders for ${targetName}`}
            className='-mr-2 inline-flex h-11 w-10 shrink-0 items-center justify-center rounded-r-xl text-base text-[color:var(--color-cream-200)]/70 transition-colors hover:bg-white/5 hover:text-[color:var(--color-gold-300)]'
         >
            ⋯
         </button>

         <PirateModal
            open={step !== null}
            onClose={close}
            dismissible={!busy}
            title={step === 'pick' ? "Captain's orders" : 'Confirm'}
         >
            {step === 'pick' && (
               <div className='flex flex-col gap-3'>
                  <p className='text-sm text-[color:var(--color-cream-200)]/85'>
                     What&apos;ll it be for{' '}
                     <span className='pirate-display text-[color:var(--color-gold-300)]'>
                        {targetName}
                     </span>
                     ?
                  </p>
                  {canPass && (
                     <PirateButton
                        variant='secondary'
                        size='md'
                        fullWidth
                        onClick={() => setStep('confirm-wheel')}
                     >
                        Promote to captain
                     </PirateButton>
                  )}
                  {canKick && (
                     <PirateButton
                        variant='danger'
                        size='md'
                        fullWidth
                        onClick={() => setStep('confirm-kick')}
                     >
                        Walk the plank
                     </PirateButton>
                  )}
                  <PirateButton variant='tertiary' size='md' fullWidth onClick={close}>
                     Cancel
                  </PirateButton>
               </div>
            )}

            {step === 'confirm-wheel' && (
               <div className='flex flex-col gap-3'>
                  <p className='text-sm text-[color:var(--color-cream-200)]/85'>
                     Hand the wheel to{' '}
                     <span className='pirate-display text-[color:var(--color-gold-300)]'>
                        {targetName}
                     </span>
                     ? They become captain and you lose moderator powers.
                  </p>
                  {error && (
                     <p className='text-sm text-[color:var(--color-coral-500)]'>{error}</p>
                  )}
                  <div className='flex gap-2'>
                     <PirateButton
                        variant='tertiary'
                        size='md'
                        fullWidth
                        onClick={() => setStep('pick')}
                        disabled={busy}
                     >
                        Back
                     </PirateButton>
                     <PirateButton
                        variant='secondary'
                        size='md'
                        fullWidth
                        onClick={doPass}
                        disabled={busy}
                     >
                        {busy ? '…' : 'Promote'}
                     </PirateButton>
                  </div>
               </div>
            )}

            {step === 'confirm-kick' && (
               <div className='flex flex-col gap-3'>
                  <p className='text-sm text-[color:var(--color-cream-200)]/85'>
                     Send{' '}
                     <span className='pirate-display text-[color:var(--color-gold-300)]'>
                        {targetName}
                     </span>{' '}
                     to the brine? They&apos;ll be booted from the lobby.
                  </p>
                  {error && (
                     <p className='text-sm text-[color:var(--color-coral-500)]'>{error}</p>
                  )}
                  <div className='flex gap-2'>
                     <PirateButton
                        variant='tertiary'
                        size='md'
                        fullWidth
                        onClick={() => setStep('pick')}
                        disabled={busy}
                     >
                        Back
                     </PirateButton>
                     <PirateButton
                        variant='danger'
                        size='md'
                        fullWidth
                        onClick={doKick}
                        disabled={busy}
                     >
                        {busy ? '…' : 'Plank'}
                     </PirateButton>
                  </div>
               </div>
            )}
         </PirateModal>
      </>
   );
}
