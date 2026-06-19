'use client';

import { useId, useState } from 'react';

/**
 * Small "ⓘ" affordance next to a stat label. Tap (or focus) toggles a short
 * tooltip explaining what the stat measures — no hover-only behaviour, so it
 * works on touch. The 44px tap target is kept while the glyph stays small via
 * negative margin so it doesn't bloat the label row.
 */
export function StatInfo({ label, description }: { label: string; description: string }) {
   const [open, setOpen] = useState(false);
   const id = useId();
   return (
      <span className='relative inline-flex'>
         <button
            type='button'
            aria-label={`What is "${label}"?`}
            aria-expanded={open}
            aria-describedby={open ? id : undefined}
            onClick={() => setOpen((v) => !v)}
            onBlur={() => setOpen(false)}
            className='-my-3 -mr-3 flex h-11 w-11 items-center justify-center text-[color:var(--color-cream-200)]/55 transition-colors hover:text-[color:var(--color-cream-100)]'
         >
            <span
               aria-hidden
               className='flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold leading-none normal-case'
            >
               i
            </span>
         </button>
         {open && (
            <span
               role='tooltip'
               id={id}
               className='absolute right-0 top-[calc(100%-0.4rem)] z-20 w-44 rounded-lg border border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-800)] px-3 py-2 text-xs font-normal normal-case tracking-normal text-[color:var(--color-cream-100)] shadow-card-deep'
            >
               {description}
            </span>
         )}
      </span>
   );
}
