'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { haptics } from '@/client/juice/haptics';
import type { RoomInviteNotice as Invite } from '@/client/realtime/useFriendInbox';

/**
 * Live notice that a friend invited you to their room. Informational + a Join
 * action; sits below the TopNav (z-30) and is announced via aria-live. Auto-
 * dismisses after 15s (invites are short-lived; longer than the friend-request
 * notice since this one is time-sensitive but still safe to miss).
 */
export function RoomInviteNotice({
   invite,
   onJoin,
   onDismiss,
}: {
   invite: Invite | null;
   onJoin: () => void;
   onDismiss: () => void;
}) {
   useEffect(() => {
      if (!invite) return;
      const t = window.setTimeout(onDismiss, 15000);
      return () => window.clearTimeout(t);
   }, [invite, onDismiss]);

   if (typeof document === 'undefined' || !invite) return null;

   return createPortal(
      <div
         role='status'
         aria-live='polite'
         className='animate-toast-in fixed left-1/2 top-[calc(env(safe-area-inset-top)+4.25rem)] z-30 flex w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 items-center gap-3 rounded-xl border border-[color:var(--color-teal-500)]/50 bg-[color:var(--color-deep-800)]/95 px-4 py-3 shadow-card-deep backdrop-blur-md'
      >
         <span className='min-w-0 flex-1 text-sm text-[color:var(--color-cream-100)]'>
            <span className='font-semibold'>{invite.fromDisplayName}</span> invited you to room{' '}
            <span className='font-mono text-[color:var(--color-gold-200)]'>{invite.code}</span>.
         </span>
         <button
            type='button'
            onClick={() => {
               haptics.tap();
               onJoin();
            }}
            className='shrink-0 rounded-lg border border-[color:var(--color-teal-500)]/60 px-3 py-1.5 text-sm font-semibold text-[color:var(--color-teal-200)] transition-colors hover:bg-[color:var(--color-teal-600)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)]'
         >
            Join
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
