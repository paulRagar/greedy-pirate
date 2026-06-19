'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export type ToastTone = 'gold' | 'blood' | 'teal';

interface ToastState {
   id: number;
   message: string;
   tone: ToastTone;
   dismissible: boolean;
}

const TONE: Record<ToastTone, string> = {
   gold:
      'bg-gradient-to-b from-[color:var(--color-gold-300)] to-[color:var(--color-gold-500)] ' +
      'text-[color:var(--color-wood-900)] treasure-glow border-[color:var(--color-gold-600)]',
   blood:
      'bg-gradient-to-b from-[color:var(--color-coral-600)] to-[color:var(--color-blood-800)] ' +
      'text-white coral-glow border-[color:var(--color-blood-800)] [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]',
   teal:
      'bg-gradient-to-b from-[color:var(--color-teal-400)] to-[color:var(--color-teal-600)] ' +
      'text-[color:var(--color-abyss-900)] teal-glow border-[color:var(--color-teal-600)]',
};

/**
 * One-at-a-time event toast for game moments ("Banked 12!", "Robbed!").
 * Returns the element to render plus a show() trigger. Auto-dismisses.
 */
export function useGameToast(duration = 1600) {
   const [toast, setToast] = useState<ToastState | null>(null);
   const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

   const dismiss = useCallback(() => {
      if (timer.current) clearTimeout(timer.current);
      setToast(null);
   }, []);

   const show = useCallback(
      (
         message: string,
         tone: ToastTone = 'gold',
         durationMs: number = duration,
         dismissible = false,
      ) => {
         if (timer.current) clearTimeout(timer.current);
         setToast({ id: Date.now(), message, tone, dismissible });
         timer.current = setTimeout(() => setToast(null), durationMs);
      },
      [duration],
   );

   useEffect(() => {
      return () => {
         if (timer.current) clearTimeout(timer.current);
      };
   }, []);

   // The live region is ALWAYS mounted so assistive tech registers it before
   // its text changes; only the inner toast toggles. Mounting the region and
   // its content in the same tick (the old `toast ? … : null`) meant the
   // announcement frequently never fired.
   const element = (
      <div
         className='pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4'
         aria-live='polite'
         aria-atomic='true'
      >
         {toast && (
            <div
               key={toast.id}
               className={cn(
                  'animate-toast-in pirate-display inline-flex items-center gap-2 rounded-full border-2 px-6 py-2.5 text-xl tracking-wider shadow-card-deep',
                  TONE[toast.tone],
                  // Only dismissible toasts capture taps; quick event toasts stay
                  // click-through so they never block the board.
                  toast.dismissible && 'pointer-events-auto',
               )}
            >
               <span>{toast.message}</span>
               {toast.dismissible && (
                  <button
                     type='button'
                     onClick={dismiss}
                     aria-label='Dismiss'
                     // Negative margins keep the pill compact while still giving a
                     // ≥44px tap target.
                     className='-my-2.5 -mr-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-2xl leading-none opacity-70 hover:opacity-100'
                  >
                     ×
                  </button>
               )}
            </div>
         )}
      </div>
   );

   return { toastElement: element, showToast: show };
}
