'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { Card as GameCard } from '@/game/types';
import { CardBack, PirateCard } from '@/ui/pirate-card/PirateCard';

interface Props {
   /** The card the engine currently has revealed (clears to null between turns). */
   currentCard: GameCard | null;
   /** Cards still in the deck. 0 once the final card has been plundered. */
   deckCount: number;
   /** Online-only: a draw is in flight and we're awaiting the server reveal. */
   drawing?: boolean;
}

/** A drawn card plus the deck size when it was drawn — a stable, ordered key. */
type PileCard = { card: GameCard; seq: number };

/**
 * The table centrepiece: the deck (face-down) on the left, the discard pile
 * (the last-drawn cards, face-up) on the right. Plundering deals a card from
 * the deck across onto the discard.
 *
 * The discard keeps the last card visible turn-to-turn — the engine clears
 * `currentCard` on bank/pass, so we accumulate draws here. We retain the top
 * two as a keyed stack: the newest deals in over the previous one (so the pile
 * never blinks empty), and each card keeps a stable identity so order holds and
 * a settled pirate never re-shakes. The deck empties on the final draw.
 */
export function DeckDiscard({ currentCard, deckCount, drawing = false }: Props) {
   const deckEmpty = deckCount <= 0;

   // deckCount strictly decreases per draw, so it's a unique ordered draw id.
   const [pile, setPile] = useState<PileCard[]>([]);
   const lastSeq = useRef<number | null>(null);
   useEffect(() => {
      if (currentCard && deckCount !== lastSeq.current) {
         lastSeq.current = deckCount;
         setPile((prev) => [...prev, { card: currentCard, seq: deckCount }].slice(-2));
      }
   }, [currentCard, deckCount]);

   return (
      <div
         className='flex h-full w-full items-center justify-center gap-4'
         // The deal animation starts one card-width + the gap to the left (over
         // the deck) and sweeps right onto the discard.
         style={{ ['--deal-from' as string]: 'calc(-100% - 1rem)' }}
      >
         {/* Deck — left */}
         <CardSlot label='Deck'>
            {deckEmpty ? <EmptyFace label='Deck dry' /> : <CardBack className='absolute inset-0 h-full w-full' />}
         </CardSlot>

         {/* Discard — right. Empty outline sits at the bottom so it persists until
             the first card lands on top; then each new card covers the prior. */}
         <CardSlot label='Discard'>
            <EmptyFace />
            {pile.map((entry, i) => (
               <PirateCard
                  key={entry.seq}
                  card={entry.card}
                  deal={i === pile.length - 1}
                  className='absolute inset-0 max-h-none'
               />
            ))}
            {drawing && (
               <div className='pointer-events-none absolute inset-0 z-40 flex items-center justify-center'>
                  <span className='pirate-display animate-pulse rounded-full border border-[color:var(--color-gold-500)]/50 bg-black/70 px-4 py-1.5 text-sm text-[color:var(--color-gold-300)]'>
                     Plunderin&apos;…
                  </span>
               </div>
            )}
         </CardSlot>
      </div>
   );
}

/**
 * A single card position. Width-driven (and capped) so two cards sit as large
 * as possible side-by-side on a phone with a little breathing room.
 */
function CardSlot({ children, label }: { children: React.ReactNode; label: string }) {
   return (
      <div className='relative aspect-[3/4] w-[clamp(120px,43vw,200px)] shrink-0' aria-label={label}>
         {children}
      </div>
   );
}

/** Dashed placeholder for an empty slot. Label omitted on the discard pile. */
function EmptyFace({ label }: { label?: string }) {
   return (
      <div
         className={cn(
            'absolute inset-0 flex items-center justify-center rounded-2xl',
            'border-2 border-dashed border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-800)]/30',
         )}
      >
         {label && (
            <span className='text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-cream-200)]/35'>
               {label}
            </span>
         )}
      </div>
   );
}
