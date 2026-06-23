import type { Card, DeckVariant, GameStatus, GameState, GoldCard, PendingDecision } from './types';

export type PublicPlayer = {
   readonly id: string;
   readonly name: string;
   readonly coins: number;
};

export type PublicGameState = {
   readonly status: GameStatus;
   readonly players: ReadonlyArray<PublicPlayer>;
   readonly turnIndex: number;
   readonly currentCard: Card | null;
   readonly currentStreak: ReadonlyArray<GoldCard>;
   readonly pirateCount: number;
   readonly variant: DeckVariant;
   readonly winnerId: string | null;
   readonly deckCount: number;
   readonly absentIds: ReadonlyArray<string>;
   /** Gold cards left in the active 2× window (0 = no multiplier running). */
   readonly multiplierRemaining: number;
   /** Banking blocked while a forced-push multiplier window runs. */
   readonly bankLocked: boolean;
   /** An Amulet is armed to soften the next pirate this turn. */
   readonly amuletArmed: boolean;
   /** A revealed card awaiting the holder's decision before DRAW. */
   readonly pendingDecision: PendingDecision | null;
};

export type RoomMetadata = {
   readonly code: string;
   readonly hostId: string;
};

export type RoomSpectatorView = {
   readonly id: string;
   readonly name: string;
};

export type RoomState = PublicGameState & RoomMetadata & {
   readonly spectators: ReadonlyArray<RoomSpectatorView>;
};

export function toPublic(state: GameState): PublicGameState {
   return {
      status: state.status,
      players: state.players.map((p) => ({ id: p.id, name: p.name, coins: p.coins })),
      turnIndex: state.turnIndex,
      currentCard: state.currentCard,
      currentStreak: state.currentStreak,
      pirateCount: state.pirateCount,
      variant: state.variant,
      winnerId: state.winnerId,
      deckCount: state.deck.length,
      absentIds: state.absentIds,
      multiplierRemaining: state.multiplierRemaining,
      bankLocked: state.bankLocked,
      amuletArmed: state.amuletArmed,
      pendingDecision: state.pendingDecision,
   };
}
