'use client';

import { PirateCard } from '@/ui/pirate-card/PirateCard';
import { DaveyCoinFlip } from '@/ui/game-room/DaveyCoinFlip';
import type { Card, DaveyToss } from '@/game/types';

type Props = {
   /** Spyglass peek — the next few cards, shown only to the player who drew it. */
   peek?: ReadonlyArray<Card>;
   /** Just-resolved Davey Jones toss. */
   daveyToss?: DaveyToss | null;
   /** Cursed Doubloon window: gold cards left at 2× (0 = none). */
   multiplierRemaining?: number;
   /** Banking blocked while a multiplier window runs. */
   bankLocked?: boolean;
   /** An Amulet is armed for the current turn. */
   amuletArmed?: boolean;
};

/**
 * Compact status band for Cursed Seas special-card effects — shared by the
 * local and online play clients. Renders nothing when there's nothing to say.
 */
export function SpecialCardStatus({ peek, daveyToss, multiplierRemaining = 0, bankLocked, amuletArmed }: Props) {
   const hasPeek = peek && peek.length > 0;
   if (!hasPeek && !daveyToss && multiplierRemaining <= 0 && !amuletArmed) return null;

   return (
      <div className='flex w-full flex-col items-center gap-2'>
         {hasPeek && (
            <div className='flex flex-col items-center gap-1'>
               <span className='text-xs uppercase tracking-[0.2em] text-[color:var(--color-gold-300)]'>
                  Spyglass · the seas ahead
               </span>
               <div className='flex gap-2' aria-label='Upcoming cards revealed by the Spyglass'>
                  {peek!.map((card, i) => (
                     <div key={i} className='h-20 w-16'>
                        <PirateCard card={card} deal={false} className='h-full w-full' />
                     </div>
                  ))}
               </div>
            </div>
         )}

         {daveyToss && <DaveyCoinFlip won={daveyToss.won} amount={daveyToss.amount} />}

         {multiplierRemaining > 0 && (
            <span className='rounded-full bg-[color:var(--color-coral-600)]/20 px-3 py-1 text-sm font-semibold text-[color:var(--color-coral-400)]'>
               2× Cursed Doubloon · {multiplierRemaining} left{bankLocked ? ' · banking locked' : ''}
            </span>
         )}

         {amuletArmed && multiplierRemaining <= 0 && (
            <span className='rounded-full bg-[color:var(--color-gold-500)]/15 px-3 py-1 text-sm font-semibold text-[color:var(--color-gold-300)]'>
               🧿 Amulet armed · next pirate spares half
            </span>
         )}
      </div>
   );
}
