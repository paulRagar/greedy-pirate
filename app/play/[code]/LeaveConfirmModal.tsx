'use client';

import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateModal } from '@/ui/pirate-modal/PirateModal';

export type LeaveConfirmKind = 'jump' | 'go-down';

type Props = {
   open: boolean;
   kind: LeaveConfirmKind;
   submitting?: boolean;
   onConfirm: () => void;
   onCancel: () => void;
};

const COPY: Record<LeaveConfirmKind, { title: string; body: string; confirm: string }> = {
   jump: {
      title: 'Jump Ship?',
      body: 'Ye sure ye want to leap overboard and leave this voyage?',
      confirm: 'Jump',
   },
   'go-down': {
      title: 'Go Down with the Ship?',
      body: "Ye're the last soul aboard. Leavin' now scuttles the vessel for good — the room closes behind ye.",
      confirm: 'Go down with the ship',
   },
};

/**
 * Confirmation before a player leaves the room. `jump` covers the
 * regular voluntary leave; `go-down` is the solo-captain variant where
 * confirming also scuttles the room.
 */
export default function LeaveConfirmModal({
   open,
   kind,
   submitting = false,
   onConfirm,
   onCancel,
}: Props) {
   const copy = COPY[kind];
   return (
      <PirateModal open={open} onClose={submitting ? undefined : onCancel} title={copy.title}>
         <p className='text-sm text-[color:var(--color-cream-200)]/85'>{copy.body}</p>
         <div className='mt-2 flex gap-2'>
            <PirateButton
               variant='tertiary'
               size='md'
               fullWidth
               onClick={onCancel}
               disabled={submitting}
            >
               Stay aboard
            </PirateButton>
            <PirateButton
               variant='secondary'
               size='md'
               fullWidth
               onClick={onConfirm}
               loading={submitting}
            >
               {copy.confirm}
            </PirateButton>
         </div>
      </PirateModal>
   );
}
