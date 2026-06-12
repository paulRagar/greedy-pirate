'use client';

import { useEffect } from 'react';
import { RainCoin } from '@/ui/effects/RainCoin';
import { TreasureChest } from '@/ui/effects/TreasureChest';

interface Props {
   amount: number;
   onDone: () => void;
}

/**
 * Bank celebration — a treasure chest pops in center screen, coins arc
 * into it, and "+N" floats up. Self-dismisses after 1s. Key the element
 * by a counter so consecutive banks replay.
 */
export function ChestBurst({ amount, onDone }: Props) {
   useEffect(() => {
      const t = setTimeout(onDone, 1000);
      return () => clearTimeout(t);
   }, [onDone]);

   return (
      <div className='pointer-events-none fixed inset-0 z-40 flex items-center justify-center' aria-hidden='true'>
         <div className='relative'>
            {[-46, -14, 18, 50].map((x, i) => (
               <div
                  key={i}
                  className='animate-coin-fly absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2'
                  style={{ ['--fly-from-x' as string]: `${x}px`, animationDelay: `${i * 70}ms` }}
               >
                  <RainCoin />
               </div>
            ))}
            <div className='animate-chest-pop'>
               <TreasureChest className='h-24 w-24' />
            </div>
            <span className='animate-bank-amount pirate-display absolute -top-2 left-1/2 -translate-x-1/2 text-3xl text-[color:var(--color-gold-300)] drop-shadow-[0_0_10px_rgb(255_182_39/0.6)]'>
               +{amount}
            </span>
         </div>
      </div>
   );
}
