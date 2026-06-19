'use client';

import { useEffect, useState } from 'react';
import { haptics } from '@/client/juice/haptics';
import { AccountLinkModal } from '@/client/auth/AccountLinkModal';
import { useFriendInbox } from '@/client/realtime/useFriendInbox';
import { FriendsDrawer, type FriendsTab } from './FriendsDrawer';
import { FriendRequestNotice } from './FriendRequestNotice';
import { FriendsTeaser } from './FriendsTeaser';

/**
 * TopNav entry point for friends. Shown to everyone signed in OR anonymous —
 * anon users get a locked teaser + sign-up CTA (GRE-42) instead of the drawer.
 * Hosts the app-wide friend-notification subscription (unread badge + incoming
 * notice); it's inert for anon.
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
   const [teaserOpen, setTeaserOpen] = useState(false);
   const [authOpen, setAuthOpen] = useState(false);

   // Deep link: `/?add={code}` opens the drawer on the Add tab, pre-filled.
   // Signed-in only — anon can't friend, so we leave the param for after sign-up.
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

   // No session at all (pre-bootstrap) — render nothing.
   if (!userId) return null;

   const Icon = (
      <button
         type='button'
         data-testid='friends-trigger'
         onClick={() => {
            haptics.tap();
            if (isAnonymous) {
               setTeaserOpen(true);
            } else {
               setInitialTab('friends');
               setInitialQuery(undefined);
               setOpen(true);
               inbox.dismissNotice();
            }
         }}
         aria-haspopup='dialog'
         aria-expanded={isAnonymous ? teaserOpen : open}
         aria-label={
            isAnonymous
               ? 'Friends — sign up to add crew'
               : inbox.unread > 0
                 ? `Friends, ${inbox.unread} new requests`
                 : 'Friends'
         }
         className='group relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-teal-500)]/40 bg-[color:var(--color-deep-800)]/70 text-[color:var(--color-gold-300)] transition-colors hover:border-[color:var(--color-gold-400)]/60 hover:text-[color:var(--color-gold-200)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-abyss-950)]'
      >
         <CrewIcon />
         {!isAnonymous && inbox.unread > 0 && (
            <span
               aria-hidden='true'
               className='absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-[color:var(--color-abyss-950)] bg-[color:var(--color-coral-500)] px-1 text-[11px] font-bold leading-none text-white'
            >
               {inbox.unread > 9 ? '9+' : inbox.unread}
            </span>
         )}
      </button>
   );

   if (isAnonymous) {
      return (
         <>
            {Icon}
            <FriendsTeaser
               open={teaserOpen}
               onClose={() => setTeaserOpen(false)}
               onSignUp={() => {
                  setTeaserOpen(false);
                  setAuthOpen(true);
               }}
            />
            <AccountLinkModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode='signup' />
         </>
      );
   }

   return (
      <>
         {Icon}
         {/* Live notice only when the drawer is closed. */}
         {!open && (
            <FriendRequestNotice
               notice={inbox.notice}
               onView={() => {
                  setInitialTab('requests');
                  setInitialQuery(undefined);
                  setOpen(true);
                  inbox.dismissNotice();
               }}
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
