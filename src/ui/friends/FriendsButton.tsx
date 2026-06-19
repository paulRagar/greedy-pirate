'use client';

import { useState } from 'react';
import { haptics } from '@/client/juice/haptics';
import { FriendsDrawer } from './FriendsDrawer';

/**
 * TopNav entry point for the Friends drawer. Signed-in only — anonymous users
 * render nothing here for now; the locked teaser/upsell is GRE-42. The unread
 * badge is wired by the request-inbox issue (GRE-40); until then `unreadCount`
 * stays 0 and the badge is hidden.
 */
export function FriendsButton({
   isAnonymous,
   unreadCount = 0,
}: {
   isAnonymous: boolean;
   unreadCount?: number;
}) {
   const [open, setOpen] = useState(false);

   if (isAnonymous) return null;

   return (
      <>
         <button
            type='button'
            data-testid='friends-trigger'
            onClick={() => {
               haptics.tap();
               setOpen(true);
            }}
            aria-haspopup='dialog'
            aria-expanded={open}
            aria-label={
               unreadCount > 0 ? `Friends, ${unreadCount} new requests` : 'Friends'
            }
            className='group relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-teal-500)]/40 bg-[color:var(--color-deep-800)]/70 text-[color:var(--color-gold-300)] transition-colors hover:border-[color:var(--color-gold-400)]/60 hover:text-[color:var(--color-gold-200)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-abyss-950)]'
         >
            <CrewIcon />
            {unreadCount > 0 && (
               <span
                  aria-hidden='true'
                  className='absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-[color:var(--color-abyss-950)] bg-[color:var(--color-coral-500)] px-1 text-[11px] font-bold leading-none text-white'
               >
                  {unreadCount > 9 ? '9+' : unreadCount}
               </span>
            )}
         </button>
         <FriendsDrawer open={open} onClose={() => setOpen(false)} />
      </>
   );
}

function CrewIcon() {
   return (
      <svg viewBox='0 0 24 24' className='h-6 w-6' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
         <circle cx='9' cy='8' r='3.2' />
         <path d='M3.5 19 a5.5 5.5 0 0 1 11 0' />
         <path d='M16 5.2 a3 3 0 0 1 0 5.6' />
         <path d='M17.5 14.2 a5.5 5.5 0 0 1 3 4.8' />
      </svg>
   );
}
