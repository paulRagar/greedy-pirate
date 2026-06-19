'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Remaining milliseconds until an absolute deadline, recomputed every animation
 * frame from wall-clock time (NOT a decrementing tick counter — that drifts
 * when a background tab throttles timers). Returns 0 when no deadline is armed
 * or the deadline has passed. rAF pauses while the tab is hidden, so the bar
 * simply freezes and snaps back to the correct value on return.
 */
export function useCountdown(deadlineMs: number | null): number {
   const [remaining, setRemaining] = useState(() =>
      deadlineMs === null ? 0 : Math.max(0, deadlineMs - Date.now()),
   );
   useEffect(() => {
      if (deadlineMs === null) {
         setRemaining(0);
         return;
      }
      let raf = 0;
      const tick = () => {
         const left = Math.max(0, deadlineMs - Date.now());
         setRemaining(left);
         if (left > 0) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
   }, [deadlineMs]);
   return remaining;
}

type Props = {
   /** Absolute deadline in epoch ms, or null when no clock is running. */
   deadlineMs: number | null;
   /** Full clock length, for the depletion fraction. */
   totalMs: number;
   /** The local player's own turn — shows the seconds readout + a haptic cue. */
   mine?: boolean;
};

const URGENT_MS = 3_000;

/**
 * A shrinking "burning fuse" bar for the active turn's shot clock. Depletes
 * teal → gold → coral as time runs out, pulses and (on the owner's turn) buzzes
 * in the final {@link URGENT_MS}. Render it for everyone watching an active
 * turn so the whole table understands why the helm moves on.
 */
export function TurnClock({ deadlineMs, totalMs, mine = false }: Props) {
   const remaining = useCountdown(deadlineMs);
   const buzzedRef = useRef(false);
   const urgent = remaining > 0 && remaining <= URGENT_MS;

   useEffect(() => {
      if (!mine) return;
      if (urgent && !buzzedRef.current) {
         buzzedRef.current = true;
         if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(180);
         }
      } else if (!urgent) {
         buzzedRef.current = false;
      }
   }, [urgent, mine]);

   if (deadlineMs === null) return null;

   const fraction = Math.max(0, Math.min(1, remaining / totalMs));
   const seconds = Math.ceil(remaining / 1000);
   const tone = urgent
      ? 'bg-[color:var(--color-coral-500)]'
      : fraction < 0.5
        ? 'bg-[color:var(--color-gold-400)]'
        : 'bg-[color:var(--color-teal-400)]';

   return (
      <div
         className='flex items-center gap-2'
         role='timer'
         aria-label={`${seconds} second${seconds === 1 ? '' : 's'} left on the turn`}
      >
         <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--color-deep-700)]/70'>
            <div
               className={cn('h-full rounded-full', tone, urgent && 'animate-pulse')}
               style={{ width: `${fraction * 100}%` }}
            />
         </div>
         {mine && (
            <span
               className={cn(
                  'min-w-[2.5ch] text-right font-mono text-xs font-bold tabular-nums',
                  urgent
                     ? 'text-[color:var(--color-coral-400)]'
                     : 'text-[color:var(--color-cream-200)]/70',
               )}
            >
               {seconds}s
            </span>
         )}
      </div>
   );
}
