'use client';

import { PirateModal } from '@/ui/pirate-modal/PirateModal';
import { PirateButton } from '@/ui/pirate-button/PirateButton';

const SAMPLE = ['Blackbeard', 'Anne Bonny', 'Calico Jack'];

/**
 * Locked friends preview for anonymous users. Friends are sign-in only
 * (GRE-42), so instead of an empty/broken drawer, anon users get this teaser +
 * a sign-up CTA. No real friend data is fetched. `onSignUp` hands off to the
 * existing AccountLinkModal flow.
 */
export function FriendsTeaser({
   open,
   onClose,
   onSignUp,
}: {
   open: boolean;
   onClose: () => void;
   onSignUp: () => void;
}) {
   return (
      <PirateModal open={open} onClose={onClose} title='Gather a crew'>
         <p className='text-sm text-[color:var(--color-cream-200)]/75'>
            Add crewmates, invite them to your ship, and compare your loot. Sign up to start your
            crew — it keeps your logbook too.
         </p>

         {/* Blurred sample list — a taste of what unlocks. */}
         <ul aria-hidden='true' className='relative mt-1 flex flex-col gap-1 select-none'>
            <div className='pointer-events-none absolute inset-0 z-10 rounded-xl bg-gradient-to-b from-transparent to-[color:var(--color-deep-800)]/80' />
            {SAMPLE.map((name) => (
               <li
                  key={name}
                  className='flex min-h-[52px] items-center gap-3 rounded-xl border border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-800)]/40 px-3 blur-[3px]'
               >
                  <span className='h-2.5 w-2.5 rounded-full bg-[color:var(--color-teal-500)]' />
                  <span className='text-sm font-semibold text-[color:var(--color-cream-100)]'>{name}</span>
               </li>
            ))}
         </ul>

         <PirateButton onClick={onSignUp} className='mt-2 w-full'>
            Sign up / Sign in
         </PirateButton>
      </PirateModal>
   );
}
