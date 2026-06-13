'use client';

import { useState } from 'react';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateModal } from '@/ui/pirate-modal/PirateModal';
import { leaveAsHost } from '@/server/actions/leaveAsHost';

export type Candidate = { id: string; displayName: string };

type Props = {
   code: string;
   open: boolean;
   candidates: Candidate[];
   onClose: () => void;
   onLeft: () => void;
};

/**
 * The captain wants out. Force a successor pick before they vacate the
 * wheel. If they skip via the safety-net button, host_left_at gets set
 * server-side (in leaveAsHost without toUserId) and the cleanup cron
 * promotes the earliest-joined sailor.
 */
export default function HostLeaveModal({ code, open, candidates, onClose, onLeft }: Props) {
   const [picked, setPicked] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const confirm = async () => {
      if (!picked) return;
      setSubmitting(true);
      setError(null);
      const res = await leaveAsHost({ code, toUserId: picked });
      setSubmitting(false);
      if (!res.ok) {
         if ('mustNominate' in res) {
            setError('Pick a successor to hand the wheel.');
            return;
         }
         setError(res.error);
         return;
      }
      onLeft();
   };

   return (
      <PirateModal open={open} onClose={onClose} title='Pass the Wheel'>
         <p className='text-sm text-[color:var(--color-cream-200)]/85'>
            Ye can&apos;t abandon the ship without naming a new captain. Pick yer successor.
         </p>
         <ul className='flex flex-col gap-1.5'>
            {candidates.map((c) => (
               <li key={c.id}>
                  <button
                     type='button'
                     onClick={() => setPicked(c.id)}
                     className={
                        picked === c.id
                           ? 'flex w-full items-center justify-between rounded-xl border-2 border-[color:var(--color-gold-400)] bg-[color:var(--color-deep-700)]/70 px-3 py-2 text-left text-[color:var(--color-gold-200)]'
                           : 'flex w-full items-center justify-between rounded-xl border-2 border-[color:var(--color-surface-border)] bg-[color:var(--color-abyss-900)]/40 px-3 py-2 text-left text-[color:var(--color-cream-200)] hover:border-[color:var(--color-gold-500)]/50'
                     }
                  >
                     <span className='pirate-display text-lg'>{c.displayName}</span>
                     {picked === c.id && (
                        <span className='text-xs uppercase tracking-wider text-[color:var(--color-gold-300)]'>
                           New captain
                        </span>
                     )}
                  </button>
               </li>
            ))}
         </ul>
         {error && <p className='text-sm text-[color:var(--color-coral-500)]'>{error}</p>}
         <div className='mt-2 flex gap-2'>
            <PirateButton variant='tertiary' size='md' fullWidth onClick={onClose} disabled={submitting}>
               Stay aboard
            </PirateButton>
            <PirateButton
               variant='secondary'
               size='md'
               fullWidth
               onClick={confirm}
               disabled={submitting || !picked}
            >
               {submitting ? '…' : 'Pass & leave'}
            </PirateButton>
         </div>
      </PirateModal>
   );
}
