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

/**
 * Per-player personal bests accrued over a single game. Surfaced to the
 * persistence layer at completion to light up the dead `user_stats` columns
 * and feed achievements — never broadcast in the public state.
 */
export type PlayerTelemetry = {
   /** High-water mark of consecutive gold cards held (whether banked or busted). */
   readonly maxStreakLength: number;
   /** Largest single banked streak value (doubloons) in one turn. */
   readonly biggestBank: number;
   /** Pirates drawn on this player's own turns. */
   readonly piratesEncountered: number;
};

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
   /** Players marked absent — turn advance skips past their seat. */
   readonly absentIds: ReadonlyArray<string>;
   /** Per-player personal bests, keyed by player id. */
   readonly telemetry: Readonly<Record<string, PlayerTelemetry>>;
};

export type PlayerInit = { readonly id: string; readonly name: string };

export type GameAction =
   | { readonly type: 'PLAYER_JOIN'; readonly player: PlayerInit }
   | { readonly type: 'PLAYER_LEAVE'; readonly playerId: string }
   | { readonly type: 'START_GAME'; readonly seed: string; readonly variant?: DeckVariant }
   | { readonly type: 'DRAW' }
   | { readonly type: 'BANK' }
   | { readonly type: 'END_TURN' }
   | { readonly type: 'SKIP_TURN'; readonly playerId: string }
   | { readonly type: 'MARK_PRESENT'; readonly playerId: string }
   | { readonly type: 'TIMEOUT_TURN'; readonly playerId: string };
