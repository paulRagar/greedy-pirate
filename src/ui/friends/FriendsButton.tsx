'use client';

import { useEffect, useState } from 'react';
import { haptics } from '@/client/juice/haptics';
import { useFriendInbox } from '@/client/realtime/useFriendInbox';
import { FriendsDrawer, type FriendsTab } from './FriendsDrawer';
import { FriendRequestNotice } from './FriendRequestNotice';

/**
 * TopNav entry point for the Friends drawer. Signed-in only — anonymous users
 * render nothing for now (the locked teaser/upsell is GRE-42). Hosts the
 * app-wide friend-notification subscription (mounted once via the TopNav): the
 * unread badge and the incoming on-screen notice both come from it.
 */
export function FriendsButton({
   userId,
   isAnonymous,
}: {
   userId: string | null;
   isAnonymous: boolean;
}) {
   const inbox = useFriendInbox(userId, isAnonymous);
   const [open, setOpen] = useState(false);
   const [initialTab, setInitialTab] = useState<FriendsTab>('friends');
   const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);

   // Deep link: `/?add={code}` opens the drawer on the Add tab, pre-filled.
   // Read from the URL once on mount and strip the param so a refresh / back
   // doesn't reopen it. Skipped for anon (they can't friend).
   useEffect(() => {
      if (isAnonymous || !userId || typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const code = params.get('add');
      if (!code) return;
      setInitialQuery(code);
      setInitialTab('add');
      setOpen(true);
      params.delete('add');
      const qs = params.toString();
      window.history.replaceState(
         null,
         '',
         window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash,
      );
   }, [isAnonymous, userId]);

   if (isAnonymous || !userId) return null;

   const openTo = (tab: FriendsTab) => {
      setInitialTab(tab);
      setInitialQuery(undefined);
      setOpen(true);
      inbox.dismissNotice();
   };

   return (
      <>
         <button
            type='button'
            data-testid='friends-trigger'
            onClick={() => {
               haptics.tap();
               openTo('friends');
            }}
            aria-haspopup='dialog'
            aria-expanded={open}
            aria-label={inbox.unread > 0 ? `Friends, ${inbox.unread} new requests` : 'Friends'}
            className='group relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-teal-500)]/40 bg-[color:var(--color-deep-800)]/70 text-[color:var(--color-gold-300)] transition-colors hover:border-[color:var(--color-gold-400)]/60 hover:text-[color:var(--color-gold-200)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-abyss-950)]'
         >
            <CrewIcon />
            {inbox.unread > 0 && (
               <span
                  aria-hidden='true'
                  className='absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-[color:var(--color-abyss-950)] bg-[color:var(--color-coral-500)] px-1 text-[11px] font-bold leading-none text-white'
               >
                  {inbox.unread > 9 ? '9+' : inbox.unread}
               </span>
            )}
         </button>

         {/* Live notice only when the drawer is closed — open the drawer and the
             Requests list updates in place instead. */}
         {!open && (
            <FriendRequestNotice
               notice={inbox.notice}
               onView={() => openTo('requests')}
               onDismiss={inbox.dismissNotice}
            />
         )}

         <FriendsDrawer
            open={open}
            onClose={() => setOpen(false)}
            inbox={inbox}
            initialTab={initialTab}
            initialQuery={initialQuery}
         />
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
