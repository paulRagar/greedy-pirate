'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { TreasureChest } from '@/ui/effects/TreasureChest';

interface Props {
   /** The banked streak's coin values, in draw order (drives the chips). */
   coins: number[];
   /** The amount banked — the running total, which drifts up and fades. */
   amount: number;
   onDone: () => void;
}

const CHIP_CLASS =
   'inline-flex h-8 min-w-[30px] shrink-0 items-center justify-center rounded-full border border-[color:var(--color-gold-600)] bg-gradient-to-b from-[color:var(--color-gold-200)] to-[color:var(--color-gold-500)] px-2 text-sm font-bold text-[color:var(--color-wood-900)] shadow-[0_2px_6px_rgb(0_0_0/0.45),0_0_10px_rgb(255_182_39/0.35),inset_0_1px_0_rgb(255_255_255/0.6)]';

/**
 * Bank celebration in the streak area. Mirrors StreakBoard's layout (total on
 * top, chips below) so nothing jumps when it swaps in: the total drifts up and
 * fades while the coin chips slide together into a treasure chest and shrink
 * away. Each chip's travel is measured to the chest so they converge precisely.
 */
export function StreakBankBurst({ coins, amount, onDone }: Props) {
   const chipsRef = useRef<HTMLDivElement>(null);
   const chestRef = useRef<HTMLDivElement>(null);
   const [go, setGo] = useState(false);

   // Hold onDone in a ref so the self-dismiss timer runs once on mount — a new
   // onDone identity each parent render (common online) must not reset it.
   const onDoneRef = useRef(onDone);
   onDoneRef.current = onDone;

   useEffect(() => {
      const chips = chipsRef.current;
      const chest = chestRef.current;
      if (chips && chest) {
         const cr = chest.getBoundingClientRect();
         const cx = cr.left + cr.width / 2;
         const cy = cr.top + cr.height / 2;
         Array.from(chips.children).forEach((el) => {
            const r = (el as HTMLElement).getBoundingClientRect();
            (el as HTMLElement).style.setProperty('--bank-dx', `${cx - (r.left + r.width / 2)}px`);
            (el as HTMLElement).style.setProperty('--bank-dy', `${cy - (r.top + r.height / 2)}px`);
         });
      }
      const raf = requestAnimationFrame(() => setGo(true));
      const t = setTimeout(() => onDoneRef.current(), 950);
      return () => {
         cancelAnimationFrame(raf);
         clearTimeout(t);
      };
   }, []);

   return (
      <div className='relative flex h-28 w-full flex-col items-center justify-start gap-1.5' aria-hidden='true'>
         {/* Total in its resting position, drifting up and fading as it's banked. */}
         <span className='animate-bank-amount pirate-display text-5xl leading-none text-[color:var(--color-gold-300)] drop-shadow-[0_2px_8px_rgb(0_0_0/0.5)] sm:text-6xl'>
            {amount}
         </span>

         {/* Chips in their original row position, sliding into the chest. */}
         <div className='flex h-10 w-full items-center justify-center'>
            <div ref={chipsRef} className='flex items-center gap-1.5 px-3'>
               {coins.map((value, i) => (
                  <span
                     key={i}
                     className={cn(CHIP_CLASS, go && 'animate-coin-bank')}
                     style={{ animationDelay: `${i * 30}ms` }}
                  >
                     {value}
                  </span>
               ))}
            </div>
         </div>

         {/* Chest sits at center where the coins converge; pops as they arrive. */}
         <div
            ref={chestRef}
            className='animate-chest-pop absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
            style={{ animationDelay: '120ms' }}
         >
            <TreasureChest className='h-16 w-16' />
         </div>
      </div>
   );
}
