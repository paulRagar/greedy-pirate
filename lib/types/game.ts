// ---- Card Types ----

export type CardType = 'coin' | 'pirate' | 'cutthroat' | 'power';

export type PowerEffect = 'shield' | 'peek' | 'swap' | 'doubleDown';

export interface Card {
   id: string;
   type: CardType;
   value: number; // coin value for coin/cutthroat cards, 0 for pirates and power cards
   name: string; // display name (e.g. "Gold Coin", "Pirate", "Cutthroat", "Shield")
   description?: string; // for power cards and special cards
   powerEffect?: PowerEffect; // only for power cards
}

// ---- Player Types ----

export interface PlayerInput {
   id: string;
   name: string;
}

export interface Player {
   id: string;
   name: string;
   coins: number;
   heldCards: Card[]; // storable power cards in hand
   hasRevengeStatus: boolean; // cutthroat revenge mechanic
   hasTurn: boolean;
}

// ---- Game State ----

export type GamePhase = 'playing' | 'finished';

export type TurnPhase =
   | 'drawing' // normal draw/bank phase
   | 'choosingCutthroatTarget' // player must pick a steal target
   | 'choosingHighSeasCount' // player is picking 1-5 for High Seas
   | 'highSeasRevealing' // High Seas cards are being drawn
   | 'peeking'; // player is viewing the top card via Peek power

export type TurnAction =
   | 'draw'
   | 'bank'
   | 'endTurn'
   | 'activateHighSeas'
   | 'highSeasDraw'
   | 'playCutthroat'
   | 'playShield'
   | 'playPeek'
   | 'playSwap'
   | 'playDoubleDown'
   | 'dismissPeek';

export interface GameState {
   phase: GamePhase;
   deck: Card[];
   originalDeckSize: number;
   cardsPlayed: number;
   players: Player[];
   currentPlayerIndex: number;
   currentCard: Card | null;
   currentStreak: Card[];
   isGameOver: boolean;
   winner: Player | null;

   // Turn phase tracking
   turnPhase: TurnPhase;

   // High Seas state
   isHighSeasActive: boolean;
   highSeasCardsRemaining: number;
   highSeasCardsDrawn: Card[];

   // Power card state
   shieldActive: boolean; // if true, next pirate is blocked
   doubleDownActive: boolean; // if true, next coin card is worth 2x
   peekCard: Card | null; // the card revealed by Peek (null when not peeking)

   // Cutthroat state
   pendingCutthroatCard: Card | null; // the cutthroat card that was drawn, awaiting target selection

   // Transient flags
   lastPirateBlocked: boolean; // true when a shield just blocked a pirate (for UI feedback)
}

// ---- Deck Configuration ----

export interface DeckCardEntry {
   type: CardType;
   value: number;
   count: number;
   name?: string;
   description?: string;
   powerEffect?: PowerEffect;
}

export interface DeckConfig {
   id: string;
   name: string;
   description: string;
   cards: DeckCardEntry[];
}
