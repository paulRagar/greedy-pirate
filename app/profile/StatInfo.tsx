'use client';

import { useId, useState } from 'react';

const WIDTH = 200;

/**
 * Small "ⓘ" affordance next to a stat label explaining what the stat measures.
 * - Desktop: hovering the icon (mouse pointer) shows the tip.
 * - Touch: tapping toggles it (no hover-only behaviour).
 * - Keyboard: focusing the button shows it; it's linked via aria-describedby.
 * The tip is positioned with viewport-clamped `fixed` coords so it can never
 * render off the edge of a narrow screen.
 */
export function StatInfo({ label, description }: { label: string; description: string }) {
   const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
   const id = useId();
   const isOpen = coords !== null;

   const openFrom = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const left = Math.min(
         Math.max(8, r.left + r.width / 2 - WIDTH / 2),
         window.innerWidth - WIDTH - 8,
      );
      setCoords({ top: r.bottom + 6, left });
   };
   const close = () => setCoords(null);

   return (
      <>
         <button
            type='button'
            aria-label={`What is "${label}"?`}
            aria-expanded={isOpen}
            aria-describedby={isOpen ? id : undefined}
            onClick={(e) => (isOpen ? close() : openFrom(e.currentTarget))}
            onPointerEnter={(e) => {
               if (e.pointerType === 'mouse') openFrom(e.currentTarget);
            }}
            onPointerLeave={(e) => {
               if (e.pointerType === 'mouse') close();
            }}
            onFocus={(e) => openFrom(e.currentTarget)}
            onBlur={close}
            className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold normal-case leading-none text-[color:var(--color-cream-200)]/70 transition-colors before:absolute before:-inset-[14px] before:content-[''] hover:bg-white/20 hover:text-[color:var(--color-cream-100)]"
         >
            i
         </button>
         {coords && (
            <span
               role='tooltip'
               id={id}
               style={{ top: coords.top, left: coords.left, width: WIDTH }}
               className='pointer-events-none fixed z-50 rounded-lg border border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-800)] px-3 py-2 text-xs font-normal normal-case tracking-normal text-[color:var(--color-cream-100)] shadow-card-deep'
            >
               {description}
            </span>
         )}
      </>
   );
}
