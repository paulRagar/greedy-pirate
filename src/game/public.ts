import type { Card, DeckVariant, GameStatus, GameState, GoldCard } from './types';

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
   };
}
