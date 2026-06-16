'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

interface Props {
   open: boolean;
   onClose?: () => void;
   dismissible?: boolean;
   title?: string;
   children: React.ReactNode;
   className?: string;
}

export function PirateModal({ open, onClose, dismissible = true, title, children, className }: Props) {
   // Portal target. Set after mount so SSR returns null instead of rendering
   // a stray overlay before hydration.
   const [mounted, setMounted] = useState(false);
   useEffect(() => {
      setMounted(true);
   }, []);

   useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent) => {
         if (e.key === 'Escape' && dismissible) onClose?.();
      };
      document.addEventListener('keydown', onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
         document.removeEventListener('keydown', onKey);
         document.body.style.overflow = prev;
      };
   }, [open, dismissible, onClose]);

   if (!open || !mounted) return null;

   // Portal to document.body so `position: fixed` is resolved against the
   // viewport. Without this, any ancestor with a backdrop-filter / filter /
   // transform creates a containing block for fixed descendants and the
   // modal misaligns (e.g. TopNav's backdrop-blur clipping the top).
   return createPortal(
      <div
         className='fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center'
         onClick={dismissible ? onClose : undefined}
         role='dialog'
         aria-modal='true'
         aria-label={title}
      >
         <div
            className={cn(
               'flex max-h-[85dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl border-t-2 border-[color:var(--color-gold-400)]/45 bg-[color:var(--color-deep-800)]/95 backdrop-blur-md p-5 shadow-card-deep safe-bottom sm:rounded-2xl sm:border-2',
               className,
            )}
            onClick={(e) => e.stopPropagation()}
         >
            {title && <h2 className='pirate-display text-2xl text-[color:var(--color-gold-300)]'>{title}</h2>}
            {children}
         </div>
      </div>,
      document.body,
   );
}
