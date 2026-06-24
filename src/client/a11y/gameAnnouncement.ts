import type { Card, GameStatus } from '@/game/types';

/**
 * Minimal view of game state needed to narrate the core feedback loop to
 * screen readers. Both play clients map their state into this shape; the
 * announcement is then derived purely by diffing the previous snapshot.
 */
export type AnnounceSnapshot = {
   status: GameStatus;
   turnIndex: number;
   currentCardKind: Card['kind'] | null;
   /** Name of the player whose turn it currently is. */
   currentName: string | null;
   /** Name of the winner once the game is complete. */
   winnerName: string | null;
   /** True when the local viewer holds the current turn (hot-seat = always). */
   isMyTurn: boolean;
};

export type Announcement = {
   message: string;
   /** Bust + game-over interrupt; routine turn changes are polite. */
   assertive: boolean;
};

/**
 * Derive the screen-reader announcement for the transition from `prev` to
 * `next`, or `null` when nothing noteworthy changed. Pure so it can be unit
 * tested without a DOM and reused identically across local + online clients.
 */
export function deriveAnnouncement(
   prev: AnnounceSnapshot | null,
   next: AnnounceSnapshot,
): Announcement | null {
   // Game over takes priority over everything else.
   if (next.status === 'complete' && (prev === null || prev.status !== 'complete')) {
      const winner = next.winnerName ?? 'Nobody';
      return { message: `Deck empty. ${winner} wins.`, assertive: true };
   }

   if (next.status !== 'active') return null;

   // First active snapshot or a fresh restart: announce whose turn it is.
   const becameActive = prev === null || prev.status !== 'active';

   const cardChanged = becameActive || prev === null || prev.currentCardKind !== next.currentCardKind;

   const bust = next.currentCardKind === 'pirate' && cardChanged;
   if (bust) {
      return { message: 'Pirate! Streak lost.', assertive: true };
   }

   // Davey Jones drags the streak under too — and gambles your banked coins.
   if (next.currentCardKind === 'davey_jones' && cardChanged) {
      return { message: 'Davey Jones! Streak lost and your bank is on the line.', assertive: true };
   }

   // Other Cursed Seas cards — a polite note as each is revealed.
   if (cardChanged) {
      const note: Partial<Record<NonNullable<AnnounceSnapshot['currentCardKind']>, string>> = {
         spyglass: 'Spyglass. Peek at the next three cards.',
         amulet: 'Amulet armed. Your next pirate spares half your streak.',
         multiplier: 'Cursed Doubloon. Bank now or ride the double.',
         monkey: 'Monkey! You snatch a coin from each rival.',
      };
      const message = next.currentCardKind ? note[next.currentCardKind] : undefined;
      if (message) return { message, assertive: false };
   }

   const turnChanged = becameActive || (prev !== null && next.turnIndex !== prev.turnIndex);
   if (turnChanged) {
      const message = next.isMyTurn
         ? 'Your turn.'
         : `${next.currentName ?? 'The next player'} is at the helm.`;
      return { message, assertive: false };
   }

   return null;
}
