'use client';

import { useEffect, useRef, useState } from 'react';
import type { Card, GameStatus } from '@/game/types';
import { haptics } from '@/client/juice/haptics';

/**
 * Shared "game juice" event core. Both play clients map their state into a
 * JuiceSnapshot; this hook diffs prev vs next and fires sounds, haptics, and
 * effect triggers. Diff-based, so it works identically for local synchronous
 * dispatch, online optimistic updates, and broadcast reconciliation (an
 * optimistic bank and its matching broadcast carry identical coins → one fire).
 */

export type JuiceSnapshot = {
   status: GameStatus;
   turnIndex: number;
   currentCardKind: Card['kind'] | null;
   /** Value of the revealed card when it's gold (else null) — used to include
       the final auto-banked card in the bank burst. */
   currentCardValue: number | null;
   streakLength: number;
   /** The current streak's coin values, in draw order. */
   streak: number[];
   players: ReadonlyArray<{ id: string; coins: number }>;
   /** Local hot-seat mode passes true — every turn is "yours". */
   isMyTurn: boolean;
};

export type BankFx = { key: number; amount: number; coins: number[] } | null;
export type SinkFx = { key: number; coins: number[] } | null;

export function useGameJuice(snap: JuiceSnapshot) {
   const prev = useRef<JuiceSnapshot | null>(null);
   const [bankFx, setBankFx] = useState<BankFx>(null);
   const [sinkFx, setSinkFx] = useState<SinkFx>(null);
   const [turnKey, setTurnKey] = useState(0);
   const [shakeKey, setShakeKey] = useState(0);

   useEffect(() => {
      const p = prev.current;
      prev.current = snap;
      if (!p) return;
      // Restarts and lobby resets fire nothing.
      const becameActive = p.status !== 'active' && snap.status === 'active';
      if (becameActive || snap.status === 'lobby') return;

      if (snap.streakLength > p.streakLength) {
         haptics.tap();
      }

      // Cursed Seas reveals get a tactile flourish — Davey Jones hits hardest.
      if (snap.currentCardKind !== p.currentCardKind) {
         if (snap.currentCardKind === 'davey_jones') {
            haptics.heavy();
         } else if (
            snap.currentCardKind === 'monkey' ||
            snap.currentCardKind === 'multiplier' ||
            snap.currentCardKind === 'spyglass' ||
            snap.currentCardKind === 'amulet'
         ) {
            haptics.tap();
         }
      }

      // Pirate revealed — sink the streak that was just lost into the card.
      if (snap.currentCardKind === 'pirate' && p.currentCardKind !== 'pirate') {
         haptics.heavy();
         setShakeKey((k) => k + 1);
         if (p.streak.length > 0) {
            setBankFx(null); // a robbery is never a bank — drop any lingering chest
            setSinkFx((fx) => ({ key: (fx?.key ?? 0) + 1, coins: p.streak }));
         }
      }

      // A player banked — coins went up. The banked coins are the streak from the
      // previous snapshot, plus the final card if this draw auto-banked the deck.
      const banked = snap.players.find((pl) => {
         const old = p.players.find((o) => o.id === pl.id);
         return old !== undefined && pl.coins > old.coins;
      });
      if (banked) {
         const old = p.players.find((o) => o.id === banked.id)!;
         const amount = banked.coins - old.coins;
         const coins =
            snap.status === 'complete' && snap.currentCardKind === 'gold' && snap.currentCardValue !== null
               ? [...p.streak, snap.currentCardValue]
               : p.streak;
         haptics.success();
         setSinkFx(null); // a bank is never a robbery — drop any lingering sink
         setBankFx((fx) => ({ key: (fx?.key ?? 0) + 1, amount, coins: coins.length > 0 ? coins : [amount] }));
      }

      if (snap.turnIndex !== p.turnIndex) {
         setTurnKey((k) => k + 1);
         if (snap.isMyTurn) {
            haptics.tap();
         }
      }
   }, [snap]);

   return {
      bankFx,
      clearBankFx: () => setBankFx(null),
      sinkFx,
      clearSinkFx: () => setSinkFx(null),
      turnKey,
      shakeKey,
   };
}
