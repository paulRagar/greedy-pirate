'use client';

import { useEffect, useRef } from 'react';
import type { GoldCard } from '@/game/types';

/**
 * The current streak as a single fixed-height coin row. Long streaks
 * overflow-scroll (edge fades) instead of wrapping, and the row follows
 * the newest coin so its pop animation is always visible.
 */
export function StreakStrip({ streak }: { streak: ReadonlyArray<GoldCard> }) {
   const ref = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({ left: el.scrollWidth, behavior: reduce ? 'auto' : 'smooth' });
   }, [streak.length]);

   return (
      <div className='flex h-10 w-full items-center justify-center'>
         {streak.length > 0 && (
            <div
               ref={ref}
               className='scrollbar-none flex max-w-full items-center gap-1.5 overflow-x-auto px-3 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]'
            >
               {streak.map((card, i) => (
                  <span key={i} className='relative shrink-0'>
                     <span
                        className='animate-coin-pop inline-flex h-8 min-w-[30px] items-center justify-center rounded-full border border-[color:var(--color-gold-600)] bg-gradient-to-b from-[color:var(--color-gold-200)] to-[color:var(--color-gold-500)] px-2 text-sm font-bold text-[color:var(--color-wood-900)] shadow-[0_2px_6px_rgb(0_0_0/0.45),0_0_10px_rgb(255_182_39/0.35),inset_0_1px_0_rgb(255_255_255/0.6)]'
                     >
                        {card.value}
                     </span>
                     {card.source === 'monkey' && (
                        <span
                           aria-label='stolen by the Monkey'
                           className='absolute -right-1 -top-1.5 text-[11px] leading-none drop-shadow-[0_1px_1px_rgb(0_0_0/0.6)]'
                        >
                           🐒
                        </span>
                     )}
                  </span>
               ))}
            </div>
         )}
      </div>
   );
}
