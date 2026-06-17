'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { deleteRoom, deleteAllRooms } from '@/server/actions/adminRooms';

export type AdminRoomRow = {
   id: string;
   code: string | null;
   isPublic: boolean;
   status: 'lobby' | 'active' | 'complete' | 'abandoned';
   deckVariant: string;
   hostName: string;
   hostEmail: string | null;
   seatedPlayers: number;
   createdAt: string;
   startedAt: string | null;
   completedAt: string | null;
};

type Filter = 'open' | 'all';

function age(iso: string): string {
   const ms = Date.now() - new Date(iso).getTime();
   const m = Math.floor(ms / 60_000);
   if (m < 1) return 'just now';
   if (m < 60) return `${m}m`;
   const h = Math.floor(m / 60);
   if (h < 24) return `${h}h`;
   const d = Math.floor(h / 24);
   return `${d}d`;
}

const STATUS_TINT: Record<AdminRoomRow['status'], string> = {
   lobby: 'bg-[color:var(--color-teal-600)]/30 text-[color:var(--color-teal-200)]',
   active: 'bg-[color:var(--color-gold-500)]/30 text-[color:var(--color-gold-200)]',
   complete: 'bg-white/10 text-[color:var(--color-cream-200)]/70',
   abandoned: 'bg-[color:var(--color-coral-600)]/30 text-[color:var(--color-coral-200)]',
};

export default function RoomsTable({ rows }: { rows: AdminRoomRow[] }) {
   const router = useRouter();
   const [filter, setFilter] = useState<Filter>('open');
   const [busyId, setBusyId] = useState<string | null>(null);
   const [bulkBusy, setBulkBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [, startTransition] = useTransition();

   const filtered = rows.filter((r) =>
      filter === 'open' ? r.status === 'lobby' || r.status === 'active' : true,
   );

   async function onDelete(row: AdminRoomRow) {
      const label = row.code ? `room ${row.code}` : `room ${row.id.slice(0, 8)}`;
      if (!confirm(`Delete ${label}? This cascades all players, events, and join requests.`)) {
         return;
      }
      setError(null);
      setBusyId(row.id);
      const res = await deleteRoom({ id: row.id });
      setBusyId(null);
      if (!res.ok) {
         setError(res.error);
         return;
      }
      startTransition(() => router.refresh());
   }

   async function onDeleteAll(scope: 'open' | 'all') {
      const targets = scope === 'open' ? filtered.filter((r) => r.status === 'lobby' || r.status === 'active') : rows;
      if (targets.length === 0) return;
      const label =
         scope === 'open'
            ? `ALL ${targets.length} open (lobby/active) rooms`
            : `EVERY room (${rows.length} total, including completed)`;
      const ok = confirm(`Delete ${label}? This cannot be undone.`);
      if (!ok) return;
      const second = prompt(`Type DELETE to confirm deleting ${targets.length} room(s):`);
      if (second !== 'DELETE') return;

      setError(null);
      setBulkBusy(true);
      const res = await deleteAllRooms(
         scope === 'open' ? { status: ['lobby', 'active'] } : {},
      );
      setBulkBusy(false);
      if (!res.ok) {
         setError(res.error);
         return;
      }
      startTransition(() => router.refresh());
   }

   return (
      <div className='space-y-4'>
         <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='inline-flex rounded-lg border border-white/10 p-1'>
               <FilterTab active={filter === 'open'} onClick={() => setFilter('open')}>
                  Open ({rows.filter((r) => r.status === 'lobby' || r.status === 'active').length})
               </FilterTab>
               <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
                  All ({rows.length})
               </FilterTab>
            </div>
            <div className='flex gap-2'>
               <PirateButton
                  variant='danger'
                  size='sm'
                  loading={bulkBusy}
                  disabled={filtered.length === 0}
                  onClick={() => onDeleteAll('open')}
               >
                  Delete all open
               </PirateButton>
               <PirateButton
                  variant='danger'
                  size='sm'
                  loading={bulkBusy}
                  disabled={rows.length === 0}
                  onClick={() => onDeleteAll('all')}
               >
                  Nuke everything
               </PirateButton>
            </div>
         </div>

         {error && (
            <div className='rounded-lg border border-[color:var(--color-coral-500)]/50 bg-[color:var(--color-coral-600)]/15 px-3 py-2 text-sm text-[color:var(--color-coral-200)]'>
               {error}
            </div>
         )}

         <div className='max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-xl border border-white/10 bg-black/20'>
            <table className='w-full table-fixed border-collapse text-xs'>
               <colgroup>
                  <col className='w-[64px]' />
                  <col className='w-[68px]' />
                  <col className='w-[78px]' />
                  <col className='w-[180px]' />
                  <col className='w-[64px]' />
                  <col className='w-[80px]' />
                  <col className='w-[56px]' />
                  <col className='w-[72px]' />
               </colgroup>
               <thead className='sticky top-0 z-10 bg-[color:var(--color-deep-800)]/95 backdrop-blur-sm'>
                  <tr className='text-left text-[11px] uppercase tracking-wider text-[color:var(--color-cream-200)]/60'>
                     <Th>Code</Th>
                     <Th>Visibility</Th>
                     <Th>Status</Th>
                     <Th>Host</Th>
                     <Th className='text-right'>Players</Th>
                     <Th>Deck</Th>
                     <Th>Age</Th>
                     <Th className='text-right'>Actions</Th>
                  </tr>
               </thead>
               <tbody>
                  {filtered.length === 0 && (
                     <tr>
                        <td colSpan={8} className='px-2 py-5 text-center opacity-60'>
                           No rooms.
                        </td>
                     </tr>
                  )}
                  {filtered.map((r) => (
                     <tr
                        key={r.id}
                        className='border-t border-white/5 hover:bg-white/[0.03]'
                     >
                        <Td>
                           <span className='font-mono text-sm tracking-wider'>
                              {r.code ?? '—'}
                           </span>
                        </Td>
                        <Td>
                           <span
                              title={r.isPublic ? 'Public' : 'Private'}
                              className={
                                 r.isPublic
                                    ? 'inline-block rounded bg-[color:var(--color-teal-600)]/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--color-teal-200)]'
                                    : 'inline-block rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--color-cream-200)]/70'
                              }
                           >
                              {r.isPublic ? 'public' : 'private'}
                           </span>
                        </Td>
                        <Td>
                           <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_TINT[r.status]}`}
                           >
                              {r.status}
                           </span>
                        </Td>
                        <Td title={r.hostEmail ? `${r.hostName} · ${r.hostEmail}` : r.hostName}>
                           <div className='truncate'>{r.hostName}</div>
                           <div className='truncate text-[10px] opacity-60'>
                              {r.hostEmail ?? 'anon'}
                           </div>
                        </Td>
                        <Td className='text-right tabular-nums'>{r.seatedPlayers}</Td>
                        <Td className='truncate opacity-80' title={r.deckVariant}>
                           {shortDeck(r.deckVariant)}
                        </Td>
                        <Td className='opacity-80'>{age(r.createdAt)}</Td>
                        <Td className='text-right'>
                           <button
                              type='button'
                              onClick={() => onDelete(r)}
                              disabled={busyId === r.id}
                              aria-label={`Delete room ${r.code ?? r.id}`}
                              className='inline-flex h-7 items-center justify-center rounded-md border border-[color:var(--color-coral-500)]/50 bg-[color:var(--color-coral-600)]/20 px-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-coral-200)] transition-colors hover:bg-[color:var(--color-coral-600)]/40 disabled:opacity-50'
                           >
                              {busyId === r.id ? '…' : 'Del'}
                           </button>
                        </Td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
   );
}

function FilterTab({
   active,
   onClick,
   children,
}: {
   active: boolean;
   onClick: () => void;
   children: React.ReactNode;
}) {
   return (
      <button
         type='button'
         onClick={onClick}
         className={`rounded-md px-3 py-1.5 text-sm font-medium tracking-wide transition-colors ${
            active
               ? 'bg-white/10 text-[color:var(--color-cream-100)]'
               : 'text-[color:var(--color-cream-200)]/60 hover:text-[color:var(--color-cream-100)]'
         }`}
      >
         {children}
      </button>
   );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
   return <th className={`px-2 py-1.5 font-semibold ${className}`}>{children}</th>;
}

function Td({
   children,
   className = '',
   title,
}: {
   children: React.ReactNode;
   className?: string;
   title?: string;
}) {
   return (
      <td className={`px-2 py-1 align-middle ${className}`} title={title}>
         {children}
      </td>
   );
}

function shortDeck(v: string): string {
   if (v === 'greedy') return 'greedy';
   if (v === 'even_greedier') return 'greedier';
   if (v === 'super_greedy') return 'super';
   return v;
}
