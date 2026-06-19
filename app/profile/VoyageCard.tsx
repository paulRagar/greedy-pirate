import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import type { VoyageView } from '@/server/voyages';

/**
 * One voyage in the logbook. `detailed` expands it from a summary line (the
 * player's own placement/coins) to the full standings with per-player stats.
 */
export function VoyageCard({
   voyage,
   youId,
   detailed = false,
}: {
   voyage: VoyageView;
   youId: string;
   detailed?: boolean;
}) {
   const you = voyage.you;
   return (
      <PiratePanel variant='deep' className='flex flex-col gap-2 p-3'>
         <div className='flex items-center justify-between gap-2'>
            <div className='flex items-center gap-2'>
               <span className='pirate-display text-lg text-[color:var(--color-gold-200)]'>
                  {prettyVariant(voyage.deckVariant)}
               </span>
               <span className='rounded-full bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--color-cream-200)]/70'>
                  {voyage.playerCount} crew
               </span>
            </div>
            <time className='text-xs text-[color:var(--color-cream-200)]/60'>
               {formatDate(voyage.completedAt)}
            </time>
         </div>

         {!detailed && you && (
            <div className='flex items-center justify-between gap-2 text-sm'>
               <span className='text-[color:var(--color-cream-200)]/80'>
                  {you.isWinner ? (
                     <span className='font-semibold text-[color:var(--color-gold-300)]'>🏆 You won</span>
                  ) : (
                     <>
                        You placed{' '}
                        <span className='font-semibold text-[color:var(--color-cream-100)]'>
                           {ordinal(you.placement)}
                        </span>
                     </>
                  )}
                  <span className='text-[color:var(--color-cream-200)]/55'> · winner {voyage.winnerName ?? '—'}</span>
               </span>
               <span className='shrink-0 font-semibold text-[color:var(--color-gold-300)]'>
                  {you.coins} doubloons
               </span>
            </div>
         )}

         {detailed && (
            <ol className='flex flex-col gap-1.5'>
               {voyage.players.map((p) => {
                  const isYou = p.userId === youId;
                  return (
                     <li
                        key={p.id}
                        className={`flex flex-col gap-1 rounded-lg px-2.5 py-2 ${
                           p.isWinner ? 'bg-[color:var(--color-gold-400)]/10' : 'bg-black/20'
                        }`}
                     >
                        <div className='flex items-center justify-between gap-2 text-sm'>
                           <span className='flex min-w-0 items-center gap-2'>
                              <span className='shrink-0 text-xs text-[color:var(--color-cream-200)]/55'>
                                 {p.placement}.
                              </span>
                              <span
                                 className={`truncate font-semibold ${
                                    p.isWinner ? 'text-[color:var(--color-gold-200)]' : ''
                                 }`}
                              >
                                 {p.displayName}
                                 {p.isWinner && <span aria-hidden> 🏆</span>}
                                 {isYou && (
                                    <span className='ml-1.5 text-xs text-[color:var(--color-cream-200)]/55'>(you)</span>
                                 )}
                              </span>
                           </span>
                           <span className='shrink-0 font-semibold text-[color:var(--color-gold-300)]'>
                              {p.coins}
                           </span>
                        </div>
                        <div className='flex flex-wrap gap-x-3 gap-y-0.5 pl-5 text-[11px] text-[color:var(--color-cream-200)]/55'>
                           <span title='Pirates faced'>🏴‍☠️ {p.piratesEncountered}</span>
                           <span title='Biggest single bank'>💰 {p.biggestBank}</span>
                           <span title='Longest streak'>🔥 {p.maxStreak}</span>
                        </div>
                     </li>
                  );
               })}
            </ol>
         )}
      </PiratePanel>
   );
}

function ordinal(n: number): string {
   const s = ['th', 'st', 'nd', 'rd'];
   const v = n % 100;
   return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function prettyVariant(variant: string): string {
   if (variant === 'greedy') return 'Greedy';
   if (variant === 'even_greedier') return 'Even Greedier';
   if (variant === 'super_greedy') return 'Super Greedy';
   return variant;
}

function formatDate(date: Date): string {
   return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
   }).format(date);
}
