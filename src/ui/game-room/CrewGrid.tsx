import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props {
   players: ReadonlyArray<{ id: string; name: string }>;
   /** Total seats — empties render as dashed placeholders so the ship fills visibly. */
   capacity: number;
   hostId?: string;
   youId?: string;
   onRemove?: (id: string) => void;
   /** Optional action slot rendered at the right edge of each player card. */
   renderRowAction?: (player: { id: string; name: string }) => ReactNode;
   /** Player IDs awaiting a decision (continuation window). Renders dimmed
    *  with an hourglass marker. */
   pendingIds?: ReadonlySet<string>;
}

/**
 * Compact 2-column crew grid for lobby + setup. 10 seats fit in ~252px,
 * so a full crew never forces the screen to scroll.
 */
export function CrewGrid({
   players,
   capacity,
   hostId,
   youId,
   onRemove,
   renderRowAction,
   pendingIds,
}: Props) {
   const emptySeats = Math.max(0, capacity - players.length);
   return (
      <ul className='grid grid-cols-2 gap-2'>
         {players.map((player, i) => {
            const pending = pendingIds?.has(player.id) ?? false;
            return (
            <li
               key={player.id}
               className={cn(
                  'flex min-h-[44px] items-center gap-2 rounded-xl border px-2.5',
                  pending
                     ? 'border-dashed border-[color:var(--color-gold-500)]/40 bg-[color:var(--color-abyss-900)]/40 opacity-60'
                     : 'border-[color:var(--color-surface-border)] bg-[color:var(--color-abyss-900)]/60',
               )}
            >
               <span className='pirate-display flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[color:var(--color-gold-300)] to-[color:var(--color-gold-500)] text-xs text-[color:var(--color-wood-900)]'>
                  {i + 1}
               </span>
               <span className='min-w-0 flex-1 truncate text-sm font-semibold'>
                  {player.name}
                  {youId && player.id === youId && (
                     <span className='ml-1 text-[10px] text-[color:var(--color-cream-200)]/55'>(you)</span>
                  )}
               </span>
               {hostId && player.id === hostId && (
                  <span
                     className='pirate-display flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-teal-400)]/15 text-[10px] text-[color:var(--color-teal-400)]'
                     title='Captain'
                     aria-label='Captain'
                  >
                     C
                  </span>
               )}
               {onRemove && (
                  <button
                     type='button'
                     onClick={() => onRemove(player.id)}
                     className='-mr-2.5 inline-flex h-11 w-10 shrink-0 items-center justify-center rounded-r-xl text-[color:var(--color-cream-200)]/60 transition-colors hover:bg-white/5 hover:text-[color:var(--color-coral-500)]'
                     aria-label={`Remove ${player.name}`}
                  >
                     ✕
                  </button>
               )}
               {pending && (
                  <span
                     className='shrink-0 text-base'
                     title='Deciding…'
                     aria-label='Deciding'
                  >
                     ⏳
                  </span>
               )}
               {renderRowAction?.(player)}
            </li>
            );
         })}
         {Array.from({ length: emptySeats }).map((_, i) => (
            <li
               key={`empty-${i}`}
               className={cn(
                  'flex min-h-[44px] items-center justify-center rounded-xl border border-dashed border-[color:var(--color-teal-500)]/25 text-xs text-dim',
               )}
               aria-hidden='true'
            >
               Empty seat
            </li>
         ))}
      </ul>
   );
}
