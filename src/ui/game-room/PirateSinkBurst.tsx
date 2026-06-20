'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface Props {
   /** The coins that were sunk, in draw order. */
   coins: number[];
   onDone: () => void;
}

const CHIP_CLASS =
   'inline-flex h-8 min-w-[30px] shrink-0 items-center justify-center rounded-full border border-[color:var(--color-gold-600)] bg-gradient-to-b from-[color:var(--color-gold-200)] to-[color:var(--color-gold-500)] px-2 text-sm font-bold text-[color:var(--color-wood-900)] shadow-[0_2px_6px_rgb(0_0_0/0.45),0_0_10px_rgb(255_182_39/0.35),inset_0_1px_0_rgb(255_255_255/0.6)]';

/**
 * Pirate robbery in the streak area. Mirrors StreakBoard's layout so nothing
 * jumps on swap: the lost total flashes red and fades while the coin chips are
 * dragged up into the pirate card on the discard pile and shrink to nothing.
 * Each chip's travel is measured to the discard slot so they vanish into it.
 */
export function PirateSinkBurst({ coins, onDone }: Props) {
   const chipsRef = useRef<HTMLDivElement>(null);
   const [go, setGo] = useState(false);
   const sum = coins.reduce((a, b) => a + b, 0);

   useEffect(() => {
      const chips = chipsRef.current;
      const target = document.querySelector('[aria-label="Discard"]');
      if (chips && target) {
         const cr = target.getBoundingClientRect();
         const cx = cr.left + cr.width / 2;
         const cy = cr.top + cr.height / 2;
         Array.from(chips.children).forEach((el) => {
            const r = (el as HTMLElement).getBoundingClientRect();
            (el as HTMLElement).style.setProperty('--bank-dx', `${cx - (r.left + r.width / 2)}px`);
            (el as HTMLElement).style.setProperty('--bank-dy', `${cy - (r.top + r.height / 2)}px`);
         });
      }
      const raf = requestAnimationFrame(() => setGo(true));
      const t = setTimeout(onDone, 1000);
      return () => {
         cancelAnimationFrame(raf);
         clearTimeout(t);
      };
   }, [onDone]);

   return (
      <div className='relative flex h-28 w-full flex-col items-center justify-start gap-1.5' aria-hidden='true'>
         {/* The lost total — flashes red and fades as the loot is dragged away. */}
         <span
            className='pirate-display text-5xl leading-none text-[color:var(--color-coral-400)] drop-shadow-[0_2px_8px_rgb(0_0_0/0.5)] transition-opacity duration-300 sm:text-6xl'
            style={{ opacity: go ? 0 : 1 }}
         >
            {sum}
         </span>

         {/* Chips in their original row position, flying into the pirate card. */}
         <div className='flex h-10 w-full items-center justify-center'>
            <div ref={chipsRef} className='flex items-center gap-1.5 px-3'>
               {coins.map((value, i) => (
                  <span
                     key={i}
                     className={cn(CHIP_CLASS, go && 'animate-coin-bank')}
                     // Brief delay so the pirate card lands before the coins are taken.
                     style={{ animationDelay: `${200 + i * 40}ms` }}
                  >
                     {value}
                  </span>
               ))}
            </div>
         </div>
      </div>
   );
}
