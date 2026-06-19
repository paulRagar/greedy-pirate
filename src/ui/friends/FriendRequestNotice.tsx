'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { haptics } from '@/client/juice/haptics';
import type { FriendNotice } from '@/client/realtime/useFriendInbox';

/**
 * Live, on-screen notice that a friend request arrived. Informational only —
 * the request persists in the Requests inbox, so this can auto-dismiss without
 * stranding anyone (the GRE-20 lesson: no countdown on an *actionable* toast).
 * Announced via aria-live; sits BELOW the TopNav (z-30 < the nav's z-40) so it
 * never covers the nav controls. "View" opens the drawer's Requests tab.
 */
export function FriendRequestNotice({
   notice,
   onView,
   onDismiss,
}: {
   notice: FriendNotice | null;
   onView: () => void;
   onDismiss: () => void;
}) {
   useEffect(() => {
      if (!notice) return;
      const t = window.setTimeout(onDismiss, 7000);
      return () => window.clearTimeout(t);
   }, [notice, onDismiss]);

   if (typeof document === 'undefined' || !notice) return null;

   return createPortal(
      <div
         role='status'
         aria-live='polite'
         className='animate-toast-in fixed left-1/2 top-[calc(env(safe-area-inset-top)+4.25rem)] z-30 flex w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 items-center gap-3 rounded-xl border border-[color:var(--color-gold-400)]/45 bg-[color:var(--color-deep-800)]/95 px-4 py-3 shadow-card-deep backdrop-blur-md'
      >
         <span className='min-w-0 flex-1 text-sm text-[color:var(--color-cream-100)]'>
            <span className='font-semibold'>{notice.fromDisplayName}</span> wants to join yer crew.
         </span>
         <button
            type='button'
            onClick={() => {
               haptics.tap();
               onView();
            }}
            className='shrink-0 rounded-lg border border-[color:var(--color-gold-400)]/60 px-3 py-1.5 text-sm font-semibold text-[color:var(--color-gold-200)] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)]'
         >
            View
         </button>
         <button
            type='button'
            onClick={onDismiss}
            aria-label='Dismiss'
            className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--color-cream-200)]/60 transition-colors hover:text-[color:var(--color-cream-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)]'
         >
            <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' aria-hidden='true'>
               <path d='M6 6 L18 18 M18 6 L6 18' />
            </svg>
         </button>
      </div>,
      document.body,
   );
}
