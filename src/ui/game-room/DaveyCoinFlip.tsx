'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
   /** True when the toss landed on 2× (the player wins the wager back, doubled). */
   won: boolean;
   /** Coins wagered from the bank. */
   amount: number;
   onDone?: () => void;
}

/**
 * Davey Jones' coin toss. A doubloon flips end-over-end and settles on one of
 * two faces: **2×** (the sea returns your gold doubled) or **Davey** (the squid
 * lord drags it to his locker). The landing face is driven by the
 * server-resolved `won`, so the animation only dramatizes an already-decided
 * outcome. Respects reduced motion (snaps to the result).
 */
export function DaveyCoinFlip({ won, amount, onDone }: Props) {
   const [spun, setSpun] = useState(false);
   const [landed, setLanded] = useState(false);
   const onDoneRef = useRef(onDone);
   onDoneRef.current = onDone;

   useEffect(() => {
      const reduce =
         typeof window !== 'undefined' &&
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const raf = requestAnimationFrame(() => setSpun(true));
      const land = setTimeout(() => setLanded(true), reduce ? 0 : 1500);
      const done = setTimeout(() => onDoneRef.current?.(), reduce ? 1200 : 2800);
      return () => {
         cancelAnimationFrame(raf);
         clearTimeout(land);
         clearTimeout(done);
      };
   }, []);

   // 2× is the front face (0°); Davey is the back (180°). Win lands on a full
   // turn (front), loss a half-turn past it (back), after several flips.
   const finalDeg = spun ? 4 * 360 + (won ? 0 : 180) : 0;

   return (
      <div className='flex flex-col items-center gap-2'>
         <div style={{ perspective: '600px' }} className='h-20 w-20'>
            <div
               className='relative h-full w-full transition-transform duration-[1400ms] ease-out [transform-style:preserve-3d]'
               style={{ transform: `rotateY(${finalDeg}deg)` }}
            >
               <div className='absolute inset-0 flex items-center justify-center rounded-full border-2 border-[color:var(--color-gold-500)] bg-gradient-to-b from-[color:var(--color-gold-200)] to-[color:var(--color-gold-500)] text-2xl font-black text-[color:var(--color-wood-900)] shadow-[0_0_18px_-2px_rgb(255_182_39/0.6)] [backface-visibility:hidden]'>
                  2×
               </div>
               <div
                  className='absolute inset-0 flex items-center justify-center rounded-full border-2 border-[color:var(--color-blood-800)] bg-gradient-to-b from-[color:var(--color-blood-700)] to-[color:var(--color-abyss-900)] text-3xl [backface-visibility:hidden]'
                  style={{ transform: 'rotateY(180deg)' }}
               >
                  🦑
               </div>
            </div>
         </div>
         {landed && (
            <span
               className={
                  won
                     ? 'pirate-display text-center text-lg text-[color:var(--color-gold-300)]'
                     : 'pirate-display text-center text-lg text-[color:var(--color-coral-400)]'
               }
            >
               {won
                  ? `2×! Your ${amount} comes back as ${amount * 2}.`
                  : `Davey Jones takes your ${amount} — and your streak.`}
            </span>
         )}
      </div>
   );
}
