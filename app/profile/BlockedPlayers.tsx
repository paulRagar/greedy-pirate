'use client';

import { useEffect, useState } from 'react';
import { listBlocked, unblockUser, type BlockedUser } from '@/server/actions/friendActions';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { haptics } from '@/client/juice/haptics';

/**
 * Profile section to review + reverse blocks (GRE-48). Display name only —
 * never the blocked user's email (org PII rule). Reads `listBlocked` /
 * `unblockUser` from the friend actions (GRE-37).
 */
export function BlockedPlayers() {
   const [blocked, setBlocked] = useState<BlockedUser[] | null>(null);
   const [busy, setBusy] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      let active = true;
      listBlocked()
         .then((res) => active && res.ok && setBlocked(res.blocked))
         .catch(() => active && setError('Could not load blocked players'));
      return () => {
         active = false;
      };
   }, []);

   const unblock = async (userId: string) => {
      setBusy(userId);
      const res = await unblockUser({ userId }).catch(() => ({ ok: false as const, error: 'Failed' }));
      setBusy(null);
      if (res.ok) setBlocked((rows) => (rows ?? []).filter((b) => b.userId !== userId));
      else setError(res.error);
   };

   return (
      <section className='flex flex-col gap-2'>
         <h2 className='pirate-display text-2xl text-[color:var(--color-gold-200)]'>Blocked players</h2>
         {error && <p className='text-sm text-[color:var(--color-coral-400)]'>{error}</p>}
         {blocked === null && !error ? (
            <PiratePanel variant='deep'>
               <p className='text-sm text-[color:var(--color-cream-200)]/55'>Loading…</p>
            </PiratePanel>
         ) : (blocked?.length ?? 0) === 0 ? (
            <PiratePanel variant='deep'>
               <p className='text-sm text-[color:var(--color-cream-200)]/70'>
                  You haven&apos;t blocked anyone. Blocked players can&apos;t send you friend requests
                  or invites.
               </p>
            </PiratePanel>
         ) : (
            <ul className='flex flex-col gap-2' data-testid='blocked-list'>
               {blocked!.map((b) => (
                  <li key={b.userId}>
                     <PiratePanel variant='deep' className='flex min-h-[56px] items-center gap-3 p-3'>
                        <span className='min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--color-cream-100)]'>
                           {b.displayName}
                        </span>
                        <button
                           type='button'
                           disabled={busy === b.userId}
                           onClick={() => {
                              haptics.tap();
                              void unblock(b.userId);
                           }}
                           className='shrink-0 rounded-lg border border-[color:var(--color-teal-500)]/50 px-3 py-2 text-sm font-semibold text-[color:var(--color-teal-200)] transition-colors hover:bg-[color:var(--color-teal-600)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] disabled:opacity-50'
                        >
                           {busy === b.userId ? 'Unblocking…' : 'Unblock'}
                        </button>
                     </PiratePanel>
                  </li>
               ))}
            </ul>
         )}
      </section>
   );
}
