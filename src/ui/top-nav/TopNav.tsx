'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { emitProfileChanged, useCurrentUser } from '@/client/auth/useCurrentUser';
import { useIsAdmin } from '@/client/auth/useIsAdmin';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { haptics } from '@/client/juice/haptics';
import { AccountLinkModal } from '@/client/auth/AccountLinkModal';
import { GuestAvatar } from '@/ui/avatar/GuestAvatar';
import { FriendsButton } from '@/ui/friends/FriendsButton';
import { SKIP_LEAVE_BEACON_KEY } from '@/lib/leaveBeacon';

const ROOM_PATH_RE = /^\/play\/([A-Z0-9]{4})$/i;

const PARENT: Record<string, string> = {
   '/choose-game': '/',
   '/setup': '/choose-game',
   '/play-local': '/setup',
   '/play/join': '/choose-game',
   '/play/new': '/choose-game',
   '/profile': '/',
};

function parentFor(pathname: string): string {
   if (PARENT[pathname]) return PARENT[pathname];
   if (pathname.startsWith('/play/')) return '/choose-game';
   return '/';
}

function firstLetterOf(name: string | undefined): string {
   return name?.trim()[0]?.toUpperCase() ?? 'P';
}

export function TopNav() {
   const pathname = usePathname();
   const { profile } = useCurrentUser();

   // SPA nav away from /play/{CODE} (back arrow, account menu, logo, any
   // internal Link) bypasses the OnlineRoomClient unload beacon. Fire the
   // leave beacon here from the layout-level component, which survives
   // pathname transitions, so the player's seat row + engine state are
   // cleaned up before the next page mounts.
   const prevPathRef = useRef(pathname);
   useEffect(() => {
      const prev = prevPathRef.current;
      prevPathRef.current = pathname;
      if (!prev || prev === pathname) return;
      const match = prev.match(ROOM_PATH_RE);
      if (!match) return;
      const code = match[1];
      try {
         if (sessionStorage.getItem(SKIP_LEAVE_BEACON_KEY) === '1') return;
      } catch {
         // private mode: fall through
      }
      if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
      try {
         const blob = new Blob([JSON.stringify({ code })], {
            type: 'application/json',
         });
         navigator.sendBeacon('/api/room/leave', blob);
      } catch {
         // beacons can't surface errors
      }
   }, [pathname]);

   if (pathname === '/') return null;

   return (
      <nav
         className='relative z-40 mb-2 flex items-center justify-between gap-3 border-b border-[color:var(--color-surface-border)] bg-[color:var(--color-abyss-900)]/55 px-4 pb-2.5 pt-[max(env(safe-area-inset-top),0.625rem)] backdrop-blur-md sm:rounded-b-2xl'
         aria-label='Primary'
      >
         <span className='inline-flex h-11 w-11 items-center'>
            <Link
               href={parentFor(pathname)}
               aria-label='Back'
               onClick={() => haptics.tap()}
               className='group inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-teal-500)]/40 bg-[color:var(--color-deep-800)]/70 text-[color:var(--color-gold-300)] transition-colors hover:border-[color:var(--color-gold-400)]/60 hover:text-[color:var(--color-gold-200)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-abyss-950)]'
            >
               <ChevronLeft />
            </Link>
         </span>

         <Link
            href='/'
            className='wordmark-gold pirate-display whitespace-nowrap text-xl leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-abyss-950)] rounded-md px-1 sm:text-2xl'
         >
            Greedy Pirate
         </Link>

         <span className='flex items-center justify-end gap-1.5'>
            <FriendsButton isAnonymous={profile?.isAnonymous ?? true} />
            <AccountMenu
               displayName={profile?.displayName}
               isAnonymous={profile?.isAnonymous ?? true}
            />
         </span>
      </nav>
   );
}

function AccountMenu({
   displayName,
   isAnonymous,
}: {
   displayName: string | undefined;
   isAnonymous: boolean;
}) {
   const router = useRouter();
   const isAdmin = useIsAdmin();
   const [open, setOpen] = useState(false);
   const [signingOut, setSigningOut] = useState(false);
   const [authModalOpen, setAuthModalOpen] = useState(false);
   const rootRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      if (!open) return;
      const onPointerDown = (e: PointerEvent) => {
         if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
      };
      const onKey = (e: KeyboardEvent) => {
         if (e.key === 'Escape') setOpen(false);
      };
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKey);
      return () => {
         document.removeEventListener('pointerdown', onPointerDown);
         document.removeEventListener('keydown', onKey);
      };
   }, [open]);

   const signOut = async () => {
      setSigningOut(true);
      try {
         const supabase = getSupabaseBrowser();
         await supabase.auth.signOut();
         await supabase.auth.signInAnonymously();
         emitProfileChanged();
         setOpen(false);
         router.push('/');
         router.refresh();
      } finally {
         setSigningOut(false);
      }
   };

   const buttonLabel = isAnonymous
      ? 'Guest menu'
      : `Account menu for ${displayName ?? 'crewmate'}`;

   return (
      <div ref={rootRef} className='relative'>
         <button
            type='button'
            data-testid='account-menu-trigger'
            onClick={() => {
               haptics.tap();
               setOpen((o) => !o);
            }}
            aria-haspopup='menu'
            aria-expanded={open}
            aria-label={buttonLabel}
            className={
               isAnonymous
                  ? 'group relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white/20 bg-white/5 text-[color:var(--color-cream-200)]/40 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-abyss-950)]'
                  : 'group relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-[color:var(--color-gold-400)]/70 bg-gradient-to-br from-[color:var(--color-coral-500)] via-[color:var(--color-orchid-600)] to-[color:var(--color-deep-700)] shadow-[0_4px_14px_-2px_rgb(0_0_0/0.5),0_0_18px_rgb(255_59_138/0.35)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-abyss-950)]'
            }
         >
            {isAnonymous ? (
               <GuestAvatar className='h-7 w-7' />
            ) : (
               <span className='pirate-display text-2xl font-bold text-[color:var(--color-cream-100)] [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]'>
                  {firstLetterOf(displayName)}
               </span>
            )}
            <span className='pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/15' />
         </button>

         {open && (
            <div
               role='menu'
               className='animate-toast-in absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-xl border border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-800)]/95 shadow-card-deep backdrop-blur-md'
            >
               {displayName && (
                  <div className='border-b border-[color:var(--color-surface-border)] px-4 py-2.5'>
                     <p className='truncate text-sm font-semibold text-[color:var(--color-cream-100)]'>
                        {displayName}
                     </p>
                     {isAnonymous && (
                        <p className='text-xs text-[color:var(--color-cream-200)]/55'>Guest crewmate</p>
                     )}
                  </div>
               )}

               {isAnonymous ? (
                  <>
                     <Link
                        href='/profile'
                        role='menuitem'
                        onClick={() => setOpen(false)}
                        className='flex min-h-[48px] items-center gap-3 px-4 text-sm font-semibold text-[color:var(--color-cream-100)] transition-colors hover:bg-white/5'
                     >
                        <LogbookIcon />
                        <span>
                           View profile
                           <span className='block text-xs font-normal text-[color:var(--color-cream-200)]/55'>
                              Yer voyages so far
                           </span>
                        </span>
                     </Link>
                     <button
                        type='button'
                        role='menuitem'
                        data-testid='account-menu-auth'
                        onClick={() => {
                           setOpen(false);
                           setAuthModalOpen(true);
                        }}
                        className='flex min-h-[48px] w-full items-center gap-3 border-t border-[color:var(--color-surface-border)] px-4 text-left text-sm font-semibold text-[color:var(--color-gold-300)] transition-colors hover:bg-white/5'
                     >
                        <SignInIcon />
                        <span>
                           Sign up / Sign in
                           <span className='block text-xs font-normal text-[color:var(--color-cream-200)]/55'>
                              Save yer logbook
                           </span>
                        </span>
                     </button>
                  </>
               ) : (
                  <>
                     <Link
                        href='/profile'
                        role='menuitem'
                        onClick={() => setOpen(false)}
                        className='flex min-h-[48px] items-center gap-3 px-4 text-sm font-semibold text-[color:var(--color-cream-100)] transition-colors hover:bg-white/5'
                     >
                        <LogbookIcon />
                        <span>
                           View profile
                           <span className='block text-xs font-normal text-[color:var(--color-cream-200)]/55'>
                              Me Logbook
                           </span>
                        </span>
                     </Link>
                     {isAdmin && (
                        <Link
                           href='/admin/rooms'
                           role='menuitem'
                           data-testid='account-menu-admin'
                           onClick={() => setOpen(false)}
                           className='flex min-h-[48px] items-center gap-3 border-t border-[color:var(--color-surface-border)] px-4 text-sm font-semibold text-[color:var(--color-teal-200)] transition-colors hover:bg-[color:var(--color-teal-600)]/15'
                        >
                           <AdminIcon />
                           <span>
                              Admin · Rooms
                              <span className='block text-xs font-normal text-[color:var(--color-cream-200)]/55'>
                                 Inspect &amp; purge
                              </span>
                           </span>
                        </Link>
                     )}
                     <button
                        type='button'
                        role='menuitem'
                        data-testid='account-menu-signout'
                        onClick={signOut}
                        disabled={signingOut}
                        className='flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-sm font-semibold text-[color:var(--color-coral-400)] transition-colors hover:bg-[color:var(--color-coral-500)]/10 disabled:opacity-60'
                     >
                        <SignOutIcon />
                        <span>
                           {signingOut ? 'Casting off…' : 'Sign out'}
                           <span className='block text-xs font-normal text-[color:var(--color-cream-200)]/55'>
                              Abandon ship
                           </span>
                        </span>
                     </button>
                  </>
               )}
            </div>
         )}

         <AccountLinkModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
   );
}

function LogbookIcon() {
   return (
      <svg viewBox='0 0 24 24' className='h-5 w-5 shrink-0 text-[color:var(--color-gold-300)]' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
         <path d='M5 4 h11 a2 2 0 0 1 2 2 v14 H7 a2 2 0 0 1 -2 -2 Z' />
         <path d='M5 17 a2 2 0 0 0 2 2' />
         <line x1='9' y1='8' x2='14' y2='8' />
         <line x1='9' y1='12' x2='14' y2='12' />
      </svg>
   );
}

function SignOutIcon() {
   return (
      <svg viewBox='0 0 24 24' className='h-5 w-5 shrink-0' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
         <path d='M14 4 H7 a2 2 0 0 0 -2 2 v12 a2 2 0 0 0 2 2 h7' />
         <path d='M17 8 L21 12 L17 16' />
         <line x1='21' y1='12' x2='10' y2='12' />
      </svg>
   );
}

function SignInIcon() {
   return (
      <svg viewBox='0 0 24 24' className='h-5 w-5 shrink-0 text-[color:var(--color-gold-300)]' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
         <path d='M10 4 H17 a2 2 0 0 1 2 2 v12 a2 2 0 0 1 -2 2 h-7' />
         <path d='M7 8 L3 12 L7 16' />
         <line x1='3' y1='12' x2='14' y2='12' />
      </svg>
   );
}

function AdminIcon() {
   return (
      <svg viewBox='0 0 24 24' className='h-5 w-5 shrink-0 text-[color:var(--color-teal-300)]' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
         <path d='M12 3 L20 6 V12 a8 8 0 0 1 -8 8 a8 8 0 0 1 -8 -8 V6 Z' />
         <path d='M9 12 L11 14 L15 10' />
      </svg>
   );
}

function ChevronLeft() {
   return (
      <svg viewBox='0 0 24 24' className='h-6 w-6' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
         <path d='M15 19 L8 12 L15 5' />
      </svg>
   );
}
