'use client';

import { useState } from 'react';
import {
   autoUpdate,
   flip,
   FloatingPortal,
   offset,
   shift,
   useClick,
   useDismiss,
   useFloating,
   useFocus,
   useInteractions,
   useRole,
} from '@floating-ui/react';

/**
 * Small "ⓘ" affordance next to a stat label explaining what the stat measures.
 * Built on Floating UI: tap (or keyboard focus) opens a tooltip that is
 * portaled to the body and auto-positioned with flip/shift so it always stays
 * on-screen — no manual coordinate math, no off-screen scroll. Click outside or
 * Escape dismisses. The icon keeps a comfortable tap target on touch.
 */
export function StatInfo({ label, description }: { label: string; description: string }) {
   const [open, setOpen] = useState(false);
   const { refs, floatingStyles, context } = useFloating({
      open,
      onOpenChange: setOpen,
      placement: 'bottom',
      middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
      whileElementsMounted: autoUpdate,
   });
   const { getReferenceProps, getFloatingProps } = useInteractions([
      useClick(context),
      useFocus(context),
      useDismiss(context),
      useRole(context, { role: 'tooltip' }),
   ]);

   return (
      <>
         <button
            ref={refs.setReference}
            type='button'
            aria-label={`What is "${label}"?`}
            {...getReferenceProps()}
            className='-m-3 inline-flex items-center justify-center p-3 text-[color:var(--color-cream-200)]/70 transition-colors hover:text-[color:var(--color-cream-100)]'
         >
            <span
               aria-hidden
               className='flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold normal-case leading-none'
            >
               i
            </span>
         </button>
         {open && (
            <FloatingPortal>
               <span
                  ref={refs.setFloating}
                  style={floatingStyles}
                  {...getFloatingProps()}
                  className='z-[70] w-48 rounded-lg border border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-800)] px-3 py-2 text-xs font-normal normal-case tracking-normal text-[color:var(--color-cream-100)] shadow-card-deep'
               >
                  {description}
               </span>
            </FloatingPortal>
         )}
      </>
   );
}
