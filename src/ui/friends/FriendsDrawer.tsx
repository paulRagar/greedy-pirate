'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
   cancelFriendRequest,
   getMyFriendCode,
   listFriends,
   listIncomingRequests,
   listOutgoingRequests,
   respondToFriendRequest,
   searchUsers,
   sendFriendRequest,
   type FriendSummary,
   type PendingRequest,
   type UserSearchResult,
} from '@/server/actions/friendActions';
import { inviteFriendToRoom } from '@/server/actions/roomInviteActions';
import type { FriendInbox } from '@/client/realtime/useFriendInbox';
import { useFriendsPresence } from '@/client/realtime/useFriendPresence';
import { haptics } from '@/client/juice/haptics';

export type FriendsTab = 'friends' | 'requests' | 'add';

const TABS: ReadonlyArray<{ id: FriendsTab; label: string }> = [
   { id: 'friends', label: 'Friends' },
   { id: 'requests', label: 'Requests' },
   { id: 'add', label: 'Add' },
];

const FOCUSABLE =
   'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function FriendsDrawer({
   open,
   onClose,
   inbox,
   initialTab = 'friends',
   initialQuery,
   currentRoomCode,
}: {
   open: boolean;
   onClose: () => void;
   inbox: FriendInbox;
   initialTab?: FriendsTab;
   /** Pre-fill the Add tab's search (from the `/?add={code}` deep link). */
   initialQuery?: string;
   /** The room the viewer is currently in (enables per-friend Invite). */
   currentRoomCode?: string | null;
}) {
   const titleId = useId();
   const panelRef = useRef<HTMLDivElement>(null);
   const restoreFocusRef = useRef<HTMLElement | null>(null);
   const [mounted, setMounted] = useState(false);
   const [tab, setTab] = useState<FriendsTab>(initialTab);

   useEffect(() => {
      setMounted(true);
   }, []);

   // Select the requested tab + reconcile the badge whenever the drawer opens.
   useEffect(() => {
      if (!open) return;
      setTab(initialTab);
      inbox.refreshUnread();
   }, [open, initialTab, inbox]);

   // Esc to close + body scroll lock while open.
   useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent) => {
         if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', onKey);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
         document.removeEventListener('keydown', onKey);
         document.body.style.overflow = prevOverflow;
      };
   }, [open, onClose]);

   // Capture the trigger, move focus into the panel on open, restore on close.
   useEffect(() => {
      if (!open) return;
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      const t = window.setTimeout(() => {
         const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
         (first ?? panelRef.current)?.focus();
      }, 0);
      return () => {
         window.clearTimeout(t);
         restoreFocusRef.current?.focus?.();
      };
   }, [open]);

   const onPanelKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
         (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
         e.preventDefault();
         last.focus();
      } else if (!e.shiftKey && active === last) {
         e.preventDefault();
         first.focus();
      }
   }, []);

   if (!open || !mounted) return null;

   return createPortal(
      <div className='fixed inset-0 z-50 flex justify-end'>
         <button
            type='button'
            aria-label='Close friends'
            tabIndex={-1}
            onClick={onClose}
            className='animate-backdrop-in absolute inset-0 bg-black/70 backdrop-blur-sm'
         />
         <div
            ref={panelRef}
            role='dialog'
            aria-modal='true'
            aria-labelledby={titleId}
            onKeyDown={onPanelKeyDown}
            className='animate-drawer-in relative flex h-full w-full max-w-sm flex-col border-l-2 border-[color:var(--color-gold-400)]/45 bg-[color:var(--color-deep-800)]/95 shadow-card-deep backdrop-blur-md safe-bottom'
         >
            <div className='flex items-center justify-between gap-3 border-b border-[color:var(--color-surface-border)] px-4 pb-3 pt-[max(env(safe-area-inset-top),0.875rem)]'>
               <h2 id={titleId} className='pirate-display text-xl text-[color:var(--color-gold-300)]'>
                  Crew
               </h2>
               <button
                  type='button'
                  onClick={() => {
                     haptics.tap();
                     onClose();
                  }}
                  aria-label='Close'
                  className='inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-teal-500)]/40 bg-[color:var(--color-deep-800)]/70 text-[color:var(--color-gold-300)] transition-colors hover:text-[color:var(--color-gold-200)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)]'
               >
                  <CloseIcon />
               </button>
            </div>

            <div role='tablist' aria-label='Friends sections' className='flex gap-1 border-b border-[color:var(--color-surface-border)] px-2'>
               {TABS.map((t) => {
                  const selected = t.id === tab;
                  const showBadge = t.id === 'requests' && inbox.unread > 0;
                  return (
                     <button
                        key={t.id}
                        type='button'
                        role='tab'
                        id={`friends-tab-${t.id}`}
                        aria-selected={selected}
                        aria-controls={`friends-panel-${t.id}`}
                        onClick={() => {
                           haptics.tap();
                           setTab(t.id);
                        }}
                        className={
                           'relative min-h-[44px] flex-1 rounded-t-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] ' +
                           (selected
                              ? 'border-b-2 border-[color:var(--color-gold-400)] text-[color:var(--color-gold-200)]'
                              : 'text-[color:var(--color-cream-200)]/60 hover:text-[color:var(--color-cream-100)]')
                        }
                     >
                        {t.label}
                        {showBadge && (
                           <span className='ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[color:var(--color-coral-500)] px-1 text-[11px] font-bold leading-none text-white'>
                              {inbox.unread > 9 ? '9+' : inbox.unread}
                           </span>
                        )}
                     </button>
                  );
               })}
            </div>

            <div className='flex-1 overflow-y-auto p-4'>
               {tab === 'friends' && (
                  <div role='tabpanel' id='friends-panel-friends' aria-labelledby='friends-tab-friends'>
                     <FriendsList open={open} version={inbox.version} currentRoomCode={currentRoomCode} />
                  </div>
               )}
               {tab === 'requests' && (
                  <div role='tabpanel' id='friends-panel-requests' aria-labelledby='friends-tab-requests'>
                     <RequestsPanel version={inbox.version} onIncomingResolved={inbox.onIncomingResolved} />
                  </div>
               )}
               {tab === 'add' && (
                  <div role='tabpanel' id='friends-panel-add' aria-labelledby='friends-tab-add'>
                     <AddPanel initialQuery={initialQuery} onIncomingResolved={inbox.onIncomingResolved} />
                  </div>
               )}
            </div>
         </div>
      </div>,
      document.body,
   );
}

function FriendsList({
   open,
   version,
   currentRoomCode,
}: {
   open: boolean;
   version: number;
   currentRoomCode?: string | null;
}) {
   const [state, setState] = useState<
      | { kind: 'loading' }
      | { kind: 'error'; error: string }
      | { kind: 'ready'; friends: FriendSummary[] }
   >({ kind: 'loading' });
   const [invited, setInvited] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});

   useEffect(() => {
      if (!open) return;
      let active = true;
      setState({ kind: 'loading' });
      listFriends()
         .then((res) => {
            if (!active) return;
            if (res.ok) setState({ kind: 'ready', friends: res.friends });
            else setState({ kind: 'error', error: res.error });
         })
         .catch(() => active && setState({ kind: 'error', error: 'Could not load crew' }));
      return () => {
         active = false;
      };
   }, [open, version]);

   const friendIds = state.kind === 'ready' ? state.friends.map((f) => f.userId) : [];
   const presence = useFriendsPresence(friendIds, open);

   const invite = async (friendId: string) => {
      if (!currentRoomCode) return;
      setInvited((m) => ({ ...m, [friendId]: 'sending' }));
      const res = await inviteFriendToRoom({ friendId, code: currentRoomCode }).catch(() => ({
         ok: false as const,
         error: 'Failed',
      }));
      setInvited((m) => ({ ...m, [friendId]: res.ok ? 'sent' : 'error' }));
   };

   if (state.kind === 'loading') {
      return <p className='py-8 text-center text-sm text-[color:var(--color-cream-200)]/55'>Hauling in yer crew…</p>;
   }
   if (state.kind === 'error') {
      return <p className='py-8 text-center text-sm text-[color:var(--color-coral-400)]'>{state.error}</p>;
   }
   if (state.friends.length === 0) {
      return (
         <div className='py-10 text-center'>
            <p className='pirate-display text-lg text-[color:var(--color-cream-100)]'>No crew yet</p>
            <p className='mt-1 text-sm text-[color:var(--color-cream-200)]/55'>Add a mate by their code to start a crew.</p>
         </div>
      );
   }

   return (
      <ul className='flex flex-col gap-1' data-testid='friends-list'>
         {state.friends.map((f) => {
            const p = presence.get(f.userId);
            const online = p !== undefined;
            const inRoom = p?.code ?? null;
            return (
               <li
                  key={f.userId}
                  className='flex min-h-[56px] items-center gap-3 rounded-xl border border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-800)]/40 px-3'
               >
                  <span
                     aria-hidden='true'
                     className={
                        'h-2.5 w-2.5 shrink-0 rounded-full ' +
                        (online
                           ? 'bg-[color:var(--color-teal-500)] shadow-[0_0_6px_var(--color-teal-500)]'
                           : 'bg-[color:var(--color-cream-200)]/25')
                     }
                  />
                  <span className='min-w-0 flex-1'>
                     <span className='block truncate text-sm font-semibold text-[color:var(--color-cream-100)]'>
                        {f.displayName}
                     </span>
                     {inRoom ? (
                        <span className='block text-xs font-semibold text-[color:var(--color-teal-200)]'>
                           In room {inRoom}
                        </span>
                     ) : (
                        <span className='block text-xs text-[color:var(--color-cream-200)]/45'>
                           {online ? 'Online' : f.friendCode}
                        </span>
                     )}
                  </span>
                  {/* Invite: only when you're in a room and the friend isn't already in it. */}
                  {currentRoomCode && inRoom !== currentRoomCode && (
                     <InviteButton
                        state={invited[f.userId]}
                        onClick={() => {
                           haptics.tap();
                           void invite(f.userId);
                        }}
                     />
                  )}
               </li>
            );
         })}
      </ul>
   );
}

function InviteButton({
   state,
   onClick,
}: {
   state: 'sending' | 'sent' | 'error' | undefined;
   onClick: () => void;
}) {
   if (state === 'sent') {
      return <span className='shrink-0 px-3 py-2 text-sm text-[color:var(--color-teal-200)]'>Invited ✓</span>;
   }
   return (
      <button
         type='button'
         disabled={state === 'sending'}
         onClick={onClick}
         className='shrink-0 rounded-lg border border-[color:var(--color-gold-400)]/60 px-3 py-2 text-sm font-semibold text-[color:var(--color-gold-200)] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] disabled:opacity-50'
      >
         {state === 'sending' ? '…' : state === 'error' ? 'Retry' : 'Invite'}
      </button>
   );
}

function RequestsPanel({
   version,
   onIncomingResolved,
}: {
   version: number;
   onIncomingResolved: () => void;
}) {
   const [incoming, setIncoming] = useState<PendingRequest[] | null>(null);
   const [outgoing, setOutgoing] = useState<PendingRequest[] | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState<string | null>(null);

   useEffect(() => {
      let active = true;
      setError(null);
      Promise.all([listIncomingRequests(), listOutgoingRequests()])
         .then(([inc, out]) => {
            if (!active) return;
            if (inc.ok) setIncoming(inc.requests);
            else setError(inc.error);
            if (out.ok) setOutgoing(out.requests);
         })
         .catch(() => active && setError('Could not load requests'));
      return () => {
         active = false;
      };
   }, [version]);

   const respond = async (requestId: string, accept: boolean) => {
      setBusy(requestId);
      const res = await respondToFriendRequest({ requestId, accept }).catch(() => ({
         ok: false as const,
         error: 'Failed',
      }));
      setBusy(null);
      if (res.ok) {
         setIncoming((rows) => (rows ?? []).filter((r) => r.requestId !== requestId));
         onIncomingResolved();
      } else {
         setError(res.error);
      }
   };

   const cancel = async (requestId: string) => {
      setBusy(requestId);
      const res = await cancelFriendRequest({ requestId }).catch(() => ({
         ok: false as const,
         error: 'Failed',
      }));
      setBusy(null);
      if (res.ok) setOutgoing((rows) => (rows ?? []).filter((r) => r.requestId !== requestId));
      else setError(res.error);
   };

   if (incoming === null && outgoing === null && !error) {
      return <p className='py-8 text-center text-sm text-[color:var(--color-cream-200)]/55'>Checking the mailbag…</p>;
   }

   const hasNothing = (incoming?.length ?? 0) === 0 && (outgoing?.length ?? 0) === 0;
   if (hasNothing && !error) {
      return (
         <div className='py-10 text-center'>
            <p className='pirate-display text-lg text-[color:var(--color-cream-100)]'>No pending requests</p>
            <p className='mt-1 text-sm text-[color:var(--color-cream-200)]/55'>New hails will show up here.</p>
         </div>
      );
   }

   return (
      <div className='flex flex-col gap-4'>
         {error && <p className='text-center text-sm text-[color:var(--color-coral-400)]'>{error}</p>}

         {(incoming?.length ?? 0) > 0 && (
            <section aria-label='Incoming requests' data-testid='incoming-requests'>
               <h3 className='mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-cream-200)]/55'>
                  Wants to join yer crew
               </h3>
               <ul className='flex flex-col gap-1'>
                  {incoming!.map((r) => (
                     <li key={r.requestId} className='flex min-h-[56px] items-center gap-2 rounded-xl border border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-800)]/40 px-3'>
                        <span className='min-w-0 flex-1'>
                           <span className='block truncate text-sm font-semibold text-[color:var(--color-cream-100)]'>{r.displayName}</span>
                           <span className='block font-mono text-xs text-[color:var(--color-cream-200)]/45'>{r.friendCode}</span>
                        </span>
                        <button
                           type='button'
                           disabled={busy === r.requestId}
                           onClick={() => {
                              haptics.tap();
                              void respond(r.requestId, true);
                           }}
                           className='shrink-0 rounded-lg border border-[color:var(--color-teal-500)]/50 px-3 py-2 text-sm font-semibold text-[color:var(--color-teal-200)] transition-colors hover:bg-[color:var(--color-teal-600)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] disabled:opacity-50'
                        >
                           Accept
                        </button>
                        <button
                           type='button'
                           disabled={busy === r.requestId}
                           onClick={() => {
                              haptics.tap();
                              void respond(r.requestId, false);
                           }}
                           aria-label={`Decline ${r.displayName}`}
                           className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[color:var(--color-coral-400)] transition-colors hover:bg-[color:var(--color-coral-500)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] disabled:opacity-50'
                        >
                           <CloseIcon small />
                        </button>
                     </li>
                  ))}
               </ul>
            </section>
         )}

         {(outgoing?.length ?? 0) > 0 && (
            <section aria-label='Sent requests' data-testid='outgoing-requests'>
               <h3 className='mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-cream-200)]/55'>
                  Sent
               </h3>
               <ul className='flex flex-col gap-1'>
                  {outgoing!.map((r) => (
                     <li key={r.requestId} className='flex min-h-[56px] items-center gap-2 rounded-xl border border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-800)]/40 px-3'>
                        <span className='min-w-0 flex-1'>
                           <span className='block truncate text-sm font-semibold text-[color:var(--color-cream-100)]'>{r.displayName}</span>
                           <span className='block text-xs text-[color:var(--color-cream-200)]/45'>Pending…</span>
                        </span>
                        <button
                           type='button'
                           disabled={busy === r.requestId}
                           onClick={() => {
                              haptics.tap();
                              void cancel(r.requestId);
                           }}
                           className='shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-[color:var(--color-cream-200)]/70 transition-colors hover:text-[color:var(--color-cream-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] disabled:opacity-50'
                        >
                           Cancel
                        </button>
                     </li>
                  ))}
               </ul>
            </section>
         )}
      </div>
   );
}

function AddPanel({
   initialQuery,
   onIncomingResolved,
}: {
   initialQuery?: string;
   onIncomingResolved: () => void;
}) {
   const [query, setQuery] = useState(initialQuery ?? '');
   const [results, setResults] = useState<UserSearchResult[] | null>(null);
   const [searching, setSearching] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [code, setCode] = useState<string | null>(null);
   const [copied, setCopied] = useState<'code' | 'link' | null>(null);
   const [busy, setBusy] = useState<string | null>(null);

   useEffect(() => {
      let active = true;
      getMyFriendCode()
         .then((r) => active && r.ok && setCode(r.friendCode))
         .catch(() => {});
      return () => {
         active = false;
      };
   }, []);

   // Debounced exact-match search.
   useEffect(() => {
      const q = query.trim();
      if (q.length === 0) {
         setResults(null);
         setError(null);
         setSearching(false);
         return;
      }
      setSearching(true);
      let active = true;
      const t = window.setTimeout(() => {
         searchUsers({ query: q })
            .then((r) => {
               if (!active) return;
               if (r.ok) {
                  setResults(r.results);
                  setError(null);
               } else {
                  setResults([]);
                  setError(r.error);
               }
            })
            .catch(() => active && (setResults([]), setError('Search failed')))
            .finally(() => active && setSearching(false));
      }, 300);
      return () => {
         active = false;
         window.clearTimeout(t);
      };
   }, [query]);

   const copy = async (text: string, which: 'code' | 'link') => {
      try {
         await navigator.clipboard.writeText(text);
         setCopied(which);
         window.setTimeout(() => setCopied(null), 1500);
      } catch {
         /* clipboard blocked — no-op */
      }
   };

   const add = async (r: UserSearchResult) => {
      setBusy(r.userId);
      const res = await sendFriendRequest({ toUserId: r.userId }).catch(() => ({
         ok: false as const,
         error: 'Failed',
      }));
      setBusy(null);
      if (res.ok) {
         const nextRel: UserSearchResult['relationship'] =
            res.status === 'friends' ? 'friend' : 'pending_out';
         // Adding someone who already asked us auto-accepts their request.
         if (r.relationship === 'pending_in') onIncomingResolved();
         setResults((rows) =>
            (rows ?? []).map((x) => (x.userId === r.userId ? { ...x, relationship: nextRel } : x)),
         );
      } else {
         setError(res.error);
      }
   };

   const shareLink =
      code && typeof window !== 'undefined' ? `${window.location.origin}/?add=${code}` : null;

   return (
      <div className='flex flex-col gap-5'>
         {/* Your code */}
         <section aria-label='Your friend code' className='rounded-xl border border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-800)]/40 p-3'>
            <h3 className='text-xs font-semibold uppercase tracking-wide text-[color:var(--color-cream-200)]/55'>Your code</h3>
            <div className='mt-2 flex items-center gap-2'>
               <code className='flex-1 truncate rounded-lg bg-black/20 px-3 py-2 font-mono text-lg tracking-widest text-[color:var(--color-gold-200)]'>
                  {code ?? '········'}
               </code>
               <button
                  type='button'
                  disabled={!code}
                  onClick={() => code && copy(code, 'code')}
                  className='shrink-0 rounded-lg border border-[color:var(--color-gold-400)]/50 px-3 py-2 text-sm font-semibold text-[color:var(--color-gold-200)] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] disabled:opacity-50'
               >
                  {copied === 'code' ? 'Copied' : 'Copy'}
               </button>
            </div>
            {shareLink && (
               <button
                  type='button'
                  onClick={() => copy(shareLink, 'link')}
                  className='mt-2 text-sm font-semibold text-[color:var(--color-teal-200)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)]'
               >
                  {copied === 'link' ? 'Link copied!' : 'Copy invite link'}
               </button>
            )}
         </section>

         {/* Search */}
         <section aria-label='Find a crewmate'>
            <label htmlFor='friend-search' className='text-xs font-semibold uppercase tracking-wide text-[color:var(--color-cream-200)]/55'>
               Add by code or name
            </label>
            <input
               id='friend-search'
               type='text'
               inputMode='text'
               autoCapitalize='characters'
               autoCorrect='off'
               spellCheck={false}
               value={query}
               onChange={(e) => setQuery(e.target.value)}
               placeholder='e.g. 7K2QF8MN'
               className='mt-2 min-h-[44px] w-full rounded-lg border border-[color:var(--color-surface-border)] bg-black/20 px-3 text-sm text-[color:var(--color-cream-100)] placeholder:text-[color:var(--color-cream-200)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)]'
            />

            <div className='mt-3'>
               {searching && (
                  <p className='py-4 text-center text-sm text-[color:var(--color-cream-200)]/55'>Searching…</p>
               )}
               {error && !searching && (
                  <p className='py-4 text-center text-sm text-[color:var(--color-coral-400)]'>{error}</p>
               )}
               {!searching && !error && results !== null && results.length === 0 && (
                  <p className='py-4 text-center text-sm text-[color:var(--color-cream-200)]/55'>
                     No crewmate with that exact code or name.
                  </p>
               )}
               {!searching && results && results.length > 0 && (
                  <ul className='flex flex-col gap-1' data-testid='search-results'>
                     {results.map((r) => (
                        <li key={r.userId} className='flex min-h-[56px] items-center gap-2 rounded-xl border border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-800)]/40 px-3'>
                           <span className='min-w-0 flex-1'>
                              <span className='block truncate text-sm font-semibold text-[color:var(--color-cream-100)]'>{r.displayName}</span>
                              <span className='block font-mono text-xs text-[color:var(--color-cream-200)]/45'>{r.friendCode}</span>
                           </span>
                           <AddAction result={r} busy={busy === r.userId} onAdd={() => void add(r)} />
                        </li>
                     ))}
                  </ul>
               )}
            </div>
         </section>
      </div>
   );
}

function AddAction({
   result,
   busy,
   onAdd,
}: {
   result: UserSearchResult;
   busy: boolean;
   onAdd: () => void;
}) {
   const base = 'shrink-0 rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)]';
   switch (result.relationship) {
      case 'self':
         return <span className='shrink-0 px-3 py-2 text-sm text-[color:var(--color-cream-200)]/45'>You</span>;
      case 'friend':
         return <span className='shrink-0 px-3 py-2 text-sm text-[color:var(--color-teal-200)]'>Friends ✓</span>;
      case 'pending_out':
         return <span className='shrink-0 px-3 py-2 text-sm text-[color:var(--color-cream-200)]/55'>Pending</span>;
      case 'pending_in':
         return (
            <button
               type='button'
               disabled={busy}
               onClick={() => {
                  haptics.tap();
                  onAdd();
               }}
               className={`${base} border border-[color:var(--color-teal-500)]/50 text-[color:var(--color-teal-200)] transition-colors hover:bg-[color:var(--color-teal-600)]/15 disabled:opacity-50`}
            >
               Accept
            </button>
         );
      default:
         return (
            <button
               type='button'
               disabled={busy}
               onClick={() => {
                  haptics.tap();
                  onAdd();
               }}
               className={`${base} border border-[color:var(--color-gold-400)]/60 text-[color:var(--color-gold-200)] transition-colors hover:bg-white/5 disabled:opacity-50`}
            >
               Add
            </button>
         );
   }
}

function CloseIcon({ small = false }: { small?: boolean }) {
   return (
      <svg viewBox='0 0 24 24' className={small ? 'h-4 w-4' : 'h-6 w-6'} fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
         <path d='M6 6 L18 18 M18 6 L6 18' />
      </svg>
   );
}
