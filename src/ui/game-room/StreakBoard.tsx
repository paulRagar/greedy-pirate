'use client';

import type { GoldCard } from '@/game/types';
import { CountUpNumber } from '@/ui/effects/CountUpNumber';
import { StreakStrip } from './StreakStrip';

/**
 * The current player's loot in hand: a large running total that counts up as
 * coins are plundered, with the individual coin chips beneath. Lives in the
 * space freed up by the side-by-side deck/discard layout. Hidden between turns —
 * the total only appears once the player has drawn their first card. A fixed
 * min-height reserves the space so the cards above don't jump.
 */
export function StreakBoard({ streak }: { streak: ReadonlyArray<GoldCard> }) {
   const sum = streak.reduce((total, card) => total + card.value, 0);
   const active = streak.length > 0;

   return (
      <div className='flex h-28 w-full flex-col items-center justify-start gap-1.5'>
         {active && (
            <>
               <CountUpNumber
                  value={sum}
                  className='pirate-display text-5xl leading-none text-[color:var(--color-gold-300)] drop-shadow-[0_2px_8px_rgb(0_0_0/0.5)] sm:text-6xl'
               />
               <StreakStrip streak={streak} />
            </>
         )}
      </div>
   );
}
