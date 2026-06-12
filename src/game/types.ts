export type GoldCard = { readonly kind: 'gold'; readonly value: number };
export type PirateCard = { readonly kind: 'pirate' };
export type Card = GoldCard | PirateCard;

export type Deck = ReadonlyArray<Card>;

export type DeckVariant = 'greedy' | 'even_greedier' | 'super_greedy';

export type Player = {
   readonly id: string;
   readonly name: string;
   readonly coins: number;
};

export type GameStatus = 'lobby' | 'active' | 'complete';

export type GameState = {
   readonly status: GameStatus;
   readonly players: ReadonlyArray<Player>;
   readonly turnIndex: number;
   readonly deck: Deck;
   readonly currentCard: Card | null;
   readonly currentStreak: ReadonlyArray<GoldCard>;
   readonly pirateCount: number;
   readonly variant: DeckVariant;
   readonly winnerId: string | null;
};

export type PlayerInit = { readonly id: string; readonly name: string };

export type GameAction =
   | { readonly type: 'PLAYER_JOIN'; readonly player: PlayerInit }
   | { readonly type: 'PLAYER_LEAVE'; readonly playerId: string }
   | { readonly type: 'START_GAME'; readonly seed: string; readonly variant?: DeckVariant }
   | { readonly type: 'DRAW' }
   | { readonly type: 'BANK' }
   | { readonly type: 'END_TURN' };
