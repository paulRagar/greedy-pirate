'use client';

import { cn } from '@/lib/cn';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { CountUpNumber } from '@/ui/effects/CountUpNumber';
import { GoldRain } from '@/ui/effects/GoldRain';
import { TreasureChest } from '@/ui/effects/TreasureChest';
import { PirateModal } from '@/ui/pirate-modal/PirateModal';

interface RankedPlayer {
   id: string;
   name: string;
   coins: number;
}

interface Props {
   open: boolean;
   winner: RankedPlayer | null;
   ranked: ReadonlyArray<RankedPlayer>;
   youId?: string;
   /** User ids who unlocked an achievement this game — badged with a medal. */
   achieverIds?: ReadonlySet<string>;
   /** The local player's own newly-unlocked achievement codes, celebrated up top. */
   yourUnlocks?: readonly string[];
   /** Action buttons row (Play again / To port etc.) */
   actions: React.ReactNode;
}

/**
 * End-of-game celebration: gold rain over the whole screen, treasure-chest
 * trophy, gold-framed winner row, full standings.
 */
export function VictoryModal({
   open,
   winner,
   ranked,
   youId,
   achieverIds,
   yourUnlocks,
   actions,
}: Props) {
   if (!open || !winner) return null;
   return (
      <>
         <GoldRain />
         <PirateModal open dismissible={false} ariaLabel={`${winner.name} wins`} className='animate-modal-pop'>
            <div className='flex flex-col gap-3'>
               <div className='flex flex-col items-center gap-2 text-center'>
                  <div className='animate-trophy-pop'>
                     <TreasureChest className='h-24 w-24' />
                  </div>
                  <span className='wordmark-gold pirate-display text-4xl leading-tight sm:text-5xl'>
                     {winner.name} wins!
                  </span>
                  <span className='text-sm uppercase tracking-[0.3em] text-[color:var(--color-coral-400)]'>
                     Captain of the haul
                  </span>
               </div>

               {yourUnlocks && yourUnlocks.length > 0 && (
                  <div className='animate-trophy-pop rounded-xl border border-[color:var(--color-gold-400)]/50 bg-[color:var(--color-gold-400)]/10 px-3 py-2 text-center'>
                     <p className='text-xs uppercase tracking-[0.25em] text-[color:var(--color-gold-300)]'>
                        Achievement{yourUnlocks.length > 1 ? 's' : ''} unlocked!
                     </p>
                     <ul className='mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1'>
                        {yourUnlocks.map((code) => {
                           const a = ACHIEVEMENTS.find((x) => x.code === code);
                           return (
                              <li
                                 key={code}
                                 className='inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--color-cream-100)]'
                              >
                                 <span aria-hidden className='text-base leading-none'>
                                    {a?.icon ?? '🏅'}
                                 </span>
                                 {a?.title ?? code}
                              </li>
                           );
                        })}
                     </ul>
                  </div>
               )}

               <ol className='flex flex-col gap-1'>
                  {ranked.map((player, idx) => {
                     const isWinner = player.id === winner.id;
                     return (
                        <li
                           key={player.id}
                           className={cn(
                              'flex items-center justify-between rounded-xl px-3 py-2 text-sm',
                              isWinner
                                 ? 'bg-gradient-to-r from-[color:var(--color-gold-400)]/25 to-[color:var(--color-coral-500)]/15 ring-1 ring-[color:var(--color-gold-400)]/60 shadow-[0_0_16px_rgb(255_182_39/0.25)]'
                                 : 'bg-black/25',
                           )}
                        >
                           <span className='flex min-w-0 items-center gap-2'>
                              <span
                                 className={cn(
                                    'pirate-display flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
                                    isWinner
                                       ? 'bg-gradient-to-b from-[color:var(--color-gold-300)] to-[color:var(--color-gold-500)] text-[color:var(--color-wood-900)]'
                                       : 'bg-white/10 text-[color:var(--color-cream-200)]',
                                 )}
                              >
                                 {idx + 1}
                              </span>
                              <span className={cn('truncate font-semibold', isWinner && 'text-[color:var(--color-gold-200)]')}>
                                 {player.name}
                                 {youId && player.id === youId && (
                                    <span className='ml-2 text-xs text-[color:var(--color-cream-200)]/55'>(you)</span>
                                 )}
                              </span>
                              {achieverIds?.has(player.id) && (
                                 <span
                                    className='shrink-0 text-base leading-none'
                                    title='Unlocked an achievement this game'
                                    aria-label='Unlocked an achievement this game'
                                 >
                                    🏅
                                 </span>
                              )}
                           </span>
                           <span className='shrink-0 font-semibold text-[color:var(--color-gold-300)]'>
                              <CountUpNumber value={player.coins} duration={900} from={0} />
                           </span>
                        </li>
                     );
                  })}
               </ol>

               <div className='flex gap-3 pt-2'>{actions}</div>
            </div>
         </PirateModal>
      </>
   );
}
