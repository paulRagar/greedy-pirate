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
 * A revealed card that parks the turn awaiting a player choice before any
 * further DRAW. Mirrors the pirate-revealed gate, but for cards that offer a
 * decision rather than a forced pass. Currently only the Cursed Doubloon
 * (multiplier): the holder chooses whether to bank their standing streak before
 * the 2× window opens. Extend the union as more interactive cards land.
 */
export type PendingDecision = { readonly kind: 'multiplier' };

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
   /**
    * The START_GAME seed, retained on state so deterministic randomness
    * (e.g. Davey Jones' coin toss) survives past the initial shuffle. Never
    * broadcast — exposing it would let a client predict tosses and deck order.
    */
   readonly rngSeed: string;
   /**
    * Monotonic counter of consumed random *events* (not deck draws). Combined
    * with `rngSeed` to derive a per-event PRNG stream, so replaying the same
    * action list reproduces the same outcomes. Namespaced away from the shuffle
    * stream, so adding tosses never perturbs the deck order. Never broadcast.
    */
   readonly rngCursor: number;
   /** Turn-scoped: an Amulet is armed to soften the next pirate this turn. */
   readonly amuletArmed: boolean;
   /** Turn-scoped: gold cards left in the active 2× window (0 = no multiplier). */
   readonly multiplierRemaining: number;
   /** Turn-scoped: banking is blocked while a forced-push multiplier window runs. */
   readonly bankLocked: boolean;
   /** Turn-scoped: a revealed card awaiting the holder's decision before DRAW. */
   readonly pendingDecision: PendingDecision | null;
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
   | { readonly type: 'TIMEOUT_TURN'; readonly playerId: string }
   | { readonly type: 'MARK_ABSENT'; readonly playerId: string };
