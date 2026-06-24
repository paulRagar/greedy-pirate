'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
   /** How many coins to fling — one per robbed rival. */
   count: number;
   onDone: () => void;
}

/**
 * Monkey heist flourish: a coin flies down from each rival's name (spread
 * across the top, where the score ribbon sits) and converges into the stash
 * below. Position-approximate (no per-name measurement) but reads as "the
 * crew's coins are coming to me". Self-dismisses; respects reduced motion.
 */
export function MonkeyHeist({ count, onDone }: Props) {
   const n = Math.min(Math.max(count, 0), 8);
   const onDoneRef = useRef(onDone);
   onDoneRef.current = onDone;
   const [go, setGo] = useState(false);

   useEffect(() => {
      const raf = requestAnimationFrame(() => setGo(true));
      const t = setTimeout(() => onDoneRef.current(), 1000);
      return () => {
         cancelAnimationFrame(raf);
         clearTimeout(t);
      };
   }, []);

   if (n === 0) return null;

   return (
      <div className='pointer-events-none fixed inset-0 z-30 overflow-hidden' aria-hidden='true'>
         {Array.from({ length: n }).map((_, i) => {
            // Spread the origins across the top band; all converge toward center.
            const startPct = n === 1 ? 50 : 12 + (76 * i) / (n - 1);
            const dx = `${(50 - startPct) * 0.9}vw`;
            return (
               <span
                  key={i}
                  className={go ? 'animate-monkey-coin' : ''}
                  style={{
                     position: 'absolute',
                     left: `${startPct}%`,
                     top: '9%',
                     // @ts-expect-error custom props
                     '--mdx': dx,
                     '--mdy': '46vh',
                     animationDelay: `${i * 70}ms`,
                  }}
               >
                  <span className='relative inline-flex h-8 min-w-[30px] items-center justify-center rounded-full border border-[color:var(--color-gold-600)] bg-gradient-to-b from-[color:var(--color-gold-200)] to-[color:var(--color-gold-500)] px-2 text-sm font-bold text-[color:var(--color-wood-900)] shadow-[0_2px_6px_rgb(0_0_0/0.45),0_0_10px_rgb(255_182_39/0.35)]'>
                     1
                     <span className='absolute -right-1 -top-1.5 text-[11px] leading-none'>🐒</span>
                  </span>
               </span>
            );
         })}
      </div>
   );
}
