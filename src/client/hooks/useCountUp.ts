'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animate a number toward `target` with an eased rAF count-up.
 * Pass `from` to start the very first render somewhere else (e.g. 0 for
 * a victory tally). Reduced motion jumps instantly.
 */
export function useCountUp(target: number, duration = 600, from?: number): number {
   const fromRef = useRef(from ?? target);
   const [display, setDisplay] = useState(from ?? target);

   useEffect(() => {
      const start = fromRef.current;
      if (start === target) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
         fromRef.current = target;
         setDisplay(target);
         return;
      }
      let raf = 0;
      const t0 = performance.now();
      const tick = (t: number) => {
         const k = Math.min(1, (t - t0) / duration);
         const eased = 1 - (1 - k) ** 3;
         setDisplay(Math.round(start + (target - start) * eased));
         if (k < 1) {
            raf = requestAnimationFrame(tick);
         } else {
            fromRef.current = target;
         }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
   }, [target, duration]);

   return display;
}
