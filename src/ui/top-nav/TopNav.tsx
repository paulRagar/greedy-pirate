'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { emitProfileChanged, useCurrentUser } from '@/client/auth/useCurrentUser';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { haptics } from '@/client/juice/haptics';
import { GuestAvatar } from '@/ui/avatar/GuestAvatar';

/**
 * Persistent top nav row of the fixed app shell:
 * - Left: contextual back button → logical PARENT route (not browser
 *   history, which gets polluted by redirects like /play/new).
 * - Center: small wordmark, links home.
 * - Right: avatar. Claimed accounts get a dropdown (profile / sign out);
 *   guests link straight to the logbook.
 * Fixed-width side slots keep the wordmark centered.
 */

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

   // Home is a full-bleed hero — no chrome over the key art. Profile is
   // reachable from every other screen.
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

         <span className='flex h-11 w-11 items-center justify-end'>
            {!profile || profile.isAnonymous ? (
               <Link
                  href='/profile'
                  aria-label='Logbook (guest)'
                  className='group relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white/20 bg-white/5 text-[color:var(--color-cream-200)]/40 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-abyss-950)]'
               >
                  <GuestAvatar className='h-7 w-7' />
               </Link>
            ) : (
               <AccountMenu displayName={profile.displayName} />
            )}
         </span>
      </nav>
   );
}

/* ───────────────────── Claimed-account avatar dropdown ───────────────────── */

function AccountMenu({ displayName }: { displayName: string }) {
   const router = useRouter();
   const [open, setOpen] = useState(false);
   const [signingOut, setSigningOut] = useState(false);
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
         // The game always needs a session — start a fresh anonymous one.
         await supabase.auth.signInAnonymously();
         emitProfileChanged();
         setOpen(false);
         router.push('/');
         router.refresh();
      } finally {
         setSigningOut(false);
      }
   };

   return (
      <div ref={rootRef} className='relative'>
         <button
            type='button'
            onClick={() => {
               haptics.tap();
               setOpen((o) => !o);
            }}
            aria-haspopup='menu'
            aria-expanded={open}
            aria-label={`Account menu for ${displayName}`}
            className='group relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-[color:var(--color-gold-400)]/70 bg-gradient-to-br from-[color:var(--color-coral-500)] via-[color:var(--color-orchid-600)] to-[color:var(--color-deep-700)] shadow-[0_4px_14px_-2px_rgb(0_0_0/0.5),0_0_18px_rgb(255_59_138/0.35)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-abyss-950)]'
         >
            <span className='pirate-display text-2xl font-bold text-[color:var(--color-cream-100)] [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]'>
               {firstLetterOf(displayName)}
            </span>
            <span className='pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/15' />
         </button>

         {open && (
            <div
               role='menu'
               className='animate-toast-in absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-xl border border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-800)]/95 shadow-card-deep backdrop-blur-md'
            >
               <div className='border-b border-[color:var(--color-surface-border)] px-4 py-2.5'>
                  <p className='truncate text-sm font-semibold text-[color:var(--color-cream-100)]'>{displayName}</p>
               </div>
               <Link
                  href='/profile'
                  role='menuitem'
                  onClick={() => setOpen(false)}
                  className='flex min-h-[48px] items-center gap-3 px-4 text-sm font-semibold text-[color:var(--color-cream-100)] transition-colors hover:bg-white/5'
               >
                  <LogbookIcon />
                  <span>
                     Me Logbook
                     <span className='block text-xs font-normal text-[color:var(--color-cream-200)]/55'>View profile</span>
                  </span>
               </Link>
               <button
                  type='button'
                  role='menuitem'
                  onClick={signOut}
                  disabled={signingOut}
                  className='flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-sm font-semibold text-[color:var(--color-coral-400)] transition-colors hover:bg-[color:var(--color-coral-500)]/10 disabled:opacity-60'
               >
                  <SignOutIcon />
                  <span>
                     {signingOut ? 'Casting off…' : 'Abandon Ship'}
                     <span className='block text-xs font-normal text-[color:var(--color-cream-200)]/55'>Sign out</span>
                  </span>
               </button>
            </div>
         )}
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

function ChevronLeft() {
   return (
      <svg viewBox='0 0 24 24' className='h-6 w-6' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
         <path d='M15 19 L8 12 L15 5' />
      </svg>
   );
}
