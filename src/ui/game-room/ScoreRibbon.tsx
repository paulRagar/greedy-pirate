'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { CountUpNumber } from '@/ui/effects/CountUpNumber';

interface Props {
   players: ReadonlyArray<{ id: string; name: string; coins: number }>;
   /** Id (not index) of the player whose turn it is — robust to filtered lists. */
   currentPlayerId: string | undefined;
   youId?: string;
   spectators?: ReadonlyArray<{ id: string; name: string }>;
}

/**
 * Horizontal score HUD — one chip per player, current turn glowing gold.
 * Centers itself when the crew fits the viewport, scrolls (with edge
 * fades) when it doesn't, and auto-centers the active player on turn
 * change. Fixed height so the play screen never reflows.
 */
export function ScoreRibbon({ players, currentPlayerId, youId, spectators = [] }: Props) {
   const scrollerRef = useRef<HTMLDivElement>(null);
   const activeRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const scroller = scrollerRef.current;
      const chip = activeRef.current;
      if (!scroller || !chip) return;
      const target = chip.offsetLeft - (scroller.clientWidth - chip.offsetWidth) / 2;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scroller.scrollTo({ left: target, behavior: reduce ? 'auto' : 'smooth' });
   }, [currentPlayerId, players.length]);

   return (
      <div className='relative z-10 -mx-4'>
         <div
            ref={scrollerRef}
            className='scrollbar-none flex snap-x overflow-x-auto px-4 py-1 [mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)]'
         >
            <div className='mx-auto flex w-max gap-2'>
               {players.map((player) => {
                  const isTurn = player.id === currentPlayerId;
                  return (
                     <div
                        key={player.id}
                        ref={isTurn ? activeRef : undefined}
                        aria-current={isTurn || undefined}
                        className={cn(
                           'flex min-h-[44px] shrink-0 snap-center items-center gap-1.5 rounded-full border border-[color:var(--color-surface-border)] bg-[color:var(--color-abyss-900)]/60 px-3 text-sm transition-colors duration-200',
                           isTurn &&
                              'border-[color:var(--color-gold-400)]/60 bg-gradient-to-r from-[color:var(--color-gold-400)]/20 to-[color:var(--color-coral-500)]/10 shadow-[0_0_14px_rgb(255_182_39/0.25)]',
                        )}
                     >
                        <span
                           className={cn(
                              'max-w-[88px] truncate font-semibold',
                              isTurn && 'text-[color:var(--color-gold-200)]',
                           )}
                        >
                           {player.name}
                        </span>
                        {player.id === youId && (
                           <span className='text-[10px] text-[color:var(--color-cream-200)]/55'>you</span>
                        )}
                        <CoinDot />
                        <span className='font-bold text-[color:var(--color-gold-300)]'>
                           <CountUpNumber value={player.coins} />
                        </span>
                     </div>
                  );
               })}
               {spectators.map((sp) => (
                  <div
                     key={`sp-${sp.id}`}
                     aria-label={`Spectator ${sp.name}`}
                     className='flex min-h-[44px] shrink-0 snap-center items-center gap-1.5 rounded-full border border-dashed border-[color:var(--color-surface-border)] bg-[color:var(--color-abyss-900)]/40 px-3 text-sm opacity-70'
                  >
                     <EyeDot />
                     <span className='max-w-[88px] truncate text-[color:var(--color-cream-200)]/85'>
                        {sp.name}
                     </span>
                     {sp.id === youId && (
                        <span className='text-[10px] text-[color:var(--color-cream-200)]/55'>you</span>
                     )}
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
}

function EyeDot() {
   return (
      <svg viewBox='0 0 14 14' className='h-3.5 w-3.5 shrink-0' aria-hidden='true'>
         <path
            d='M1.5 7c1.5-2.7 3.5-4 5.5-4s4 1.3 5.5 4c-1.5 2.7-3.5 4-5.5 4s-4-1.3-5.5-4z'
            fill='none'
            stroke='var(--color-cream-200)'
            strokeOpacity='0.55'
            strokeWidth='1.1'
         />
         <circle cx='7' cy='7' r='1.6' fill='var(--color-cream-200)' fillOpacity='0.6' />
      </svg>
   );
}

function CoinDot() {
   return (
      <svg viewBox='0 0 12 12' className='h-3 w-3 shrink-0' aria-hidden='true'>
         <circle cx='6' cy='6' r='5' fill='var(--color-gold-400)' stroke='var(--color-gold-600)' strokeWidth='1' />
         <circle cx='4.5' cy='4.5' r='1.2' fill='var(--color-gold-200)' />
      </svg>
   );
}
