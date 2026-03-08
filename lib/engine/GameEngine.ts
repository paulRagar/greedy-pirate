import {
   Card,
   CardType,
   GamePhase,
   GameState,
   Player,
   PlayerInput,
   TurnAction,
   TurnPhase,
} from '@/types/game';
import { buildDeck, getDeckConfigById, shuffleDeck } from './deckBuilder';

// ---- Game Engine ----

/**
 * Pure TypeScript game engine for Greedy Pirate.
 * No React, no DOM, no localStorage — just game state transitions.
 *
 * Usage:
 *   const engine = new GameEngine();
 *   engine.startGame(players, 'standard');
 *   engine.drawCard();
 *   engine.bankCards();
 *   const state = engine.getState();
 */
export class GameEngine {
   private state: GameState;

   constructor() {
      this.state = this.createEmptyState();
   }

   // ---- Initialization ----

   /**
    * Start a new game with the given players and deck config.
    * Players are in the order provided; first player gets the first turn.
    */
   startGame(playerInputs: PlayerInput[], deckConfigId: string): GameState {
      const deckConfig = getDeckConfigById(deckConfigId);
      if (!deckConfig) {
         throw new Error(`Unknown deck config: ${deckConfigId}`);
      }

      const rawDeck = buildDeck(deckConfig);
      const shuffledDeck = shuffleDeck(rawDeck);

      const players: Player[] = playerInputs.map((input, index) => ({
         id: input.id,
         name: input.name,
         coins: 0,
         heldCards: [],
         hasRevengeStatus: false,
         hasTurn: index === 0,
      }));

      this.state = {
         phase: 'playing',
         deck: shuffledDeck,
         originalDeckSize: shuffledDeck.length,
         cardsPlayed: 0,
         players,
         currentPlayerIndex: 0,
         currentCard: null,
         currentStreak: [],
         isGameOver: false,
         winner: null,

         turnPhase: 'drawing',

         isHighSeasActive: false,
         highSeasCardsRemaining: 0,
         highSeasCardsDrawn: [],

         shieldActive: false,
         doubleDownActive: false,
         peekCard: null,

         pendingCutthroatCard: null,
         lastPirateBlocked: false,
      };

      return this.getState();
   }

   /**
    * Start a game with a pre-shuffled deck and players already set.
    * Used by "Play Again" and "Shuffle Crew" flows.
    */
   startGameWithPlayers(players: PlayerInput[], deckConfigId: string, shufflePlayers: boolean = false): GameState {
      const orderedPlayers = shufflePlayers ? this.shuffleArray([...players]) : [...players];
      return this.startGame(orderedPlayers, deckConfigId);
   }

   // ---- Core Actions ----

   /**
    * Draw the top card from the deck.
    * Handles coin, pirate, cutthroat, and power card logic.
    */
   drawCard(): GameState {
      if (this.state.isGameOver) return this.getState();
      if (this.state.deck.length === 0) return this.getState();
      if (this.state.turnPhase !== 'drawing') return this.getState();
      if (this.state.currentCard?.type === 'pirate') return this.getState();

      // Clear transient flags from previous draw
      this.state.lastPirateBlocked = false;

      const deck = [...this.state.deck];
      const topCard = deck.shift()!;
      this.state.deck = deck;
      this.state.cardsPlayed++;
      this.state.currentCard = topCard;

      // If deck is now empty, the game ends after this card
      if (deck.length === 0) {
         this.finishGame(topCard);
         return this.getState();
      }

      // Handle card by type
      switch (topCard.type) {
         case 'coin':
            this.handleCoinDraw(topCard);
            break;
         case 'pirate':
            this.handlePirateDraw(topCard);
            break;
         case 'cutthroat':
            this.handleCutthroatDraw(topCard);
            break;
         case 'power':
            this.handlePowerDraw(topCard);
            break;
      }

      return this.getState();
   }

   /**
    * Bank the current streak: add coin values to the current player's total,
    * then advance to the next player's turn.
    */
   bankCards(): GameState {
      if (this.state.isGameOver) return this.getState();
      if (this.state.currentStreak.length === 0) return this.getState();
      if (this.state.currentCard?.type === 'pirate') return this.getState();
      if (this.state.turnPhase !== 'drawing') return this.getState();

      const player = this.currentPlayer();
      const streakSum = this.calculateStreakValue();
      player.coins += streakSum;

      this.advanceTurn();
      return this.getState();
   }

   /**
    * End the current turn without banking (after a pirate card).
    * Advances to the next player.
    */
   endTurn(): GameState {
      if (this.state.isGameOver) return this.getState();
      if (this.state.currentCard?.type !== 'pirate') return this.getState();

      this.advanceTurn();
      return this.getState();
   }

   // ---- High Seas Actions ----

   /**
    * Activate the High Seas gamble.
    * Only available when 50%+ of the deck has been played and the player has coins or a streak.
    */
   activateHighSeas(): GameState {
      if (this.state.isGameOver) return this.getState();
      if (this.state.turnPhase !== 'drawing') return this.getState();
      if (!this.canActivateHighSeas()) return this.getState();

      this.state.turnPhase = 'choosingHighSeasCount';
      return this.getState();
   }

   /**
    * Set the number of High Seas cards to draw (1-5) and begin the reveal phase.
    */
   setHighSeasCount(count: number): GameState {
      if (this.state.turnPhase !== 'choosingHighSeasCount') return this.getState();
      if (count < 1 || count > 5) return this.getState();

      // Can't draw more cards than remain in the deck
      const actualCount = Math.min(count, this.state.deck.length);

      this.state.isHighSeasActive = true;
      this.state.highSeasCardsRemaining = actualCount;
      this.state.highSeasCardsDrawn = [];
      this.state.turnPhase = 'highSeasRevealing';

      return this.getState();
   }

   /**
    * Draw the next High Seas card. If a pirate is drawn, the gamble fails.
    * If all cards are drawn without a pirate, coin values are doubled.
    */
   highSeasDraw(): GameState {
      if (this.state.turnPhase !== 'highSeasRevealing') return this.getState();
      if (this.state.highSeasCardsRemaining <= 0) return this.getState();
      if (this.state.deck.length === 0) return this.getState();

      const deck = [...this.state.deck];
      const topCard = deck.shift()!;
      this.state.deck = deck;
      this.state.cardsPlayed++;
      this.state.currentCard = topCard;
      this.state.highSeasCardsRemaining--;
      this.state.highSeasCardsDrawn.push(topCard);

      // If deck empties during High Seas, game ends
      if (deck.length === 0) {
         // If the last card was a pirate, streak is lost
         if (topCard.type === 'pirate') {
            this.state.isHighSeasActive = false;
            this.state.highSeasCardsRemaining = 0;
            this.finishGame(topCard);
         } else {
            // Double the High Seas cards and add everything to streak, then finish
            this.applyHighSeasSuccess();
            this.finishGame(topCard);
         }
         return this.getState();
      }

      if (topCard.type === 'pirate') {
         // High Seas failed: pirate drawn
         if (this.state.shieldActive) {
            // Shield blocks the pirate even in High Seas
            this.state.shieldActive = false;
            // Continue High Seas, the pirate is neutralized
            if (this.state.highSeasCardsRemaining === 0) {
               this.applyHighSeasSuccess();
            }
         } else {
            // High Seas fails: lose the streak
            this.state.currentStreak = [];
            this.state.isHighSeasActive = false;
            this.state.highSeasCardsRemaining = 0;
            this.state.highSeasCardsDrawn = [];
            // Turn doesn't auto-end; pirate card is shown, player must hit End Turn
         }
      } else {
         // Non-pirate drawn during High Seas
         if (this.state.highSeasCardsRemaining === 0) {
            // All High Seas cards drawn successfully
            this.applyHighSeasSuccess();
         }
      }

      return this.getState();
   }

   /**
    * Cancel High Seas selection and return to drawing phase.
    */
   cancelHighSeas(): GameState {
      if (this.state.turnPhase !== 'choosingHighSeasCount') return this.getState();
      this.state.turnPhase = 'drawing';
      return this.getState();
   }

   // ---- Cutthroat Actions ----

   /**
    * Select a target player for a cutthroat steal.
    */
   selectCutthroatTarget(targetPlayerId: string): GameState {
      if (this.state.turnPhase !== 'choosingCutthroatTarget') return this.getState();
      if (!this.state.pendingCutthroatCard) return this.getState();

      const currentPlayer = this.currentPlayer();
      const targetPlayer = this.state.players.find((p) => p.id === targetPlayerId);
      if (!targetPlayer || targetPlayer.id === currentPlayer.id) return this.getState();

      let stealAmount = this.state.pendingCutthroatCard.value;

      // If current player has revenge status, steal double
      if (currentPlayer.hasRevengeStatus) {
         stealAmount *= 2;
         currentPlayer.hasRevengeStatus = false;
      }

      // Can't steal more than the target has
      const actualSteal = Math.min(stealAmount, targetPlayer.coins);
      targetPlayer.coins -= actualSteal;
      currentPlayer.coins += actualSteal;

      // Target gains revenge status
      targetPlayer.hasRevengeStatus = true;

      // Clear cutthroat state, continue turn
      this.state.pendingCutthroatCard = null;
      this.state.currentCard = null;
      this.state.turnPhase = 'drawing';

      return this.getState();
   }

   // ---- Power Card Actions ----

   /**
    * Play a power card from the current player's hand.
    */
   playPowerCard(cardId: string): GameState {
      if (this.state.isGameOver) return this.getState();
      if (this.state.turnPhase !== 'drawing') return this.getState();

      const player = this.currentPlayer();
      const cardIndex = player.heldCards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return this.getState();

      const card = player.heldCards[cardIndex];
      if (card.type !== 'power') return this.getState();

      // Remove card from hand
      player.heldCards.splice(cardIndex, 1);

      switch (card.powerEffect) {
         case 'shield':
            this.state.shieldActive = true;
            break;
         case 'peek':
            if (this.state.deck.length > 0) {
               this.state.peekCard = this.state.deck[0];
               this.state.turnPhase = 'peeking';
            }
            break;
         case 'swap':
            // Swap requires target selection — for now, handled via selectSwapTarget
            this.state.turnPhase = 'choosingCutthroatTarget'; // reuse target selection phase
            this.state.pendingCutthroatCard = card; // store the swap card temporarily
            break;
         case 'doubleDown':
            this.state.doubleDownActive = true;
            break;
      }

      return this.getState();
   }

   /**
    * Dismiss the peek card view and return to drawing.
    */
   dismissPeek(): GameState {
      if (this.state.turnPhase !== 'peeking') return this.getState();
      this.state.peekCard = null;
      this.state.turnPhase = 'drawing';
      return this.getState();
   }

   /**
    * Select a target player for a swap power card.
    */
   selectSwapTarget(targetPlayerId: string): GameState {
      if (this.state.turnPhase !== 'choosingCutthroatTarget') return this.getState();
      if (!this.state.pendingCutthroatCard) return this.getState();

      // Check if this is actually a swap (not a cutthroat)
      if (this.state.pendingCutthroatCard.powerEffect === 'swap') {
         const currentPlayer = this.currentPlayer();
         const targetPlayer = this.state.players.find((p) => p.id === targetPlayerId);
         if (!targetPlayer || targetPlayer.id === currentPlayer.id) return this.getState();

         // Swap coin totals
         const temp = currentPlayer.coins;
         currentPlayer.coins = targetPlayer.coins;
         targetPlayer.coins = temp;

         this.state.pendingCutthroatCard = null;
         this.state.currentCard = null;
         this.state.turnPhase = 'drawing';

         return this.getState();
      }

      // Otherwise, it's a regular cutthroat
      return this.selectCutthroatTarget(targetPlayerId);
   }

   // ---- Queries ----

   /**
    * Returns a deep copy of the current game state.
    */
   getState(): GameState {
      return structuredClone(this.state);
   }

   /**
    * Whether the High Seas gamble can be activated.
    * Requires 50%+ deck played and the player has coins > 0 OR a streak > 0.
    */
   canActivateHighSeas(): boolean {
      if (this.state.isGameOver) return false;
      if (this.state.turnPhase !== 'drawing') return false;
      if (this.state.currentCard?.type === 'pirate') return false;
      if (this.state.deck.length === 0) return false;

      const deckPercentPlayed = this.state.cardsPlayed / this.state.originalDeckSize;
      if (deckPercentPlayed < 0.5) return false;

      const player = this.currentPlayer();
      const streakValue = this.calculateStreakValue();
      if (player.coins <= 0 && streakValue <= 0) return false;

      return true;
   }

   /**
    * Get the available actions for the current game state.
    */
   getAvailableActions(): TurnAction[] {
      if (this.state.isGameOver) return [];

      const actions: TurnAction[] = [];

      switch (this.state.turnPhase) {
         case 'drawing':
            if (this.state.currentCard?.type === 'pirate') {
               actions.push('endTurn');
            } else {
               if (this.state.deck.length > 0) {
                  actions.push('draw');
               }
               if (this.state.currentStreak.length > 0) {
                  actions.push('bank');
               }
               if (this.canActivateHighSeas()) {
                  actions.push('activateHighSeas');
               }

               // Power cards from hand
               const player = this.currentPlayer();
               for (const card of player.heldCards) {
                  if (card.powerEffect === 'shield') actions.push('playShield');
                  if (card.powerEffect === 'peek') actions.push('playPeek');
                  if (card.powerEffect === 'swap') actions.push('playSwap');
                  if (card.powerEffect === 'doubleDown') actions.push('playDoubleDown');
               }
            }
            break;

         case 'choosingCutthroatTarget':
            actions.push('playCutthroat');
            break;

         case 'choosingHighSeasCount':
            actions.push('activateHighSeas');
            break;

         case 'highSeasRevealing':
            actions.push('highSeasDraw');
            break;

         case 'peeking':
            actions.push('dismissPeek');
            break;
      }

      return actions;
   }

   /**
    * Get the current player object (by reference for internal mutation).
    */
   private currentPlayer(): Player {
      return this.state.players[this.state.currentPlayerIndex];
   }

   /**
    * Calculate the sum of coin values in the current streak.
    */
   private calculateStreakValue(): number {
      return this.state.currentStreak.reduce((sum, card) => {
         // Sum all cards with a value (coins always, cutthroat cards added during High Seas)
         return sum + (card.value || 0);
      }, 0);
   }

   // ---- Internal State Transitions ----

   private handleCoinDraw(card: Card): void {
      let value = card.value;

      // Double Down doubles the coin's value
      if (this.state.doubleDownActive) {
         value *= 2;
         this.state.doubleDownActive = false;
      }

      // Add a card with the (possibly doubled) value to the streak
      const streakCard: Card = { ...card, value };
      this.state.currentStreak.push(streakCard);
   }

   private handlePirateDraw(card: Card): void {
      if (this.state.shieldActive) {
         // Shield blocks the pirate; streak is safe
         this.state.shieldActive = false;
         this.state.lastPirateBlocked = true;
         // Clear the pirate from currentCard so the player can continue drawing
         this.state.currentCard = null;
         return;
      }

      // Pirate! Lose the streak.
      this.state.currentStreak = [];
      // The turn doesn't auto-end. The player needs to hit "End Turn" to see the pirate,
      // which matches the original UX (finishTurn is called separately).
   }

   private handleCutthroatDraw(card: Card): void {
      // Cutthroat goes to choosing-target phase
      this.state.pendingCutthroatCard = card;
      this.state.turnPhase = 'choosingCutthroatTarget';
   }

   private handlePowerDraw(card: Card): void {
      const player = this.currentPlayer();
      const maxHandSize = 3;

      if (player.heldCards.length < maxHandSize) {
         // Add to player's hand
         player.heldCards.push(card);
      } else {
         // Hand is full — card is wasted (could optionally auto-play, but spec says max 3)
         // For now, the card is just lost
      }

      // Power card draw doesn't add to streak; the player continues drawing
      // We clear currentCard so the UI knows to allow another draw
      // Actually, we should show the power card briefly. The UI can handle this.
   }

   private applyHighSeasSuccess(): void {
      // All High Seas cards drawn without a pirate — double their coin values and add to streak
      for (const card of this.state.highSeasCardsDrawn) {
         if (card.type === 'coin') {
            const doubledCard: Card = { ...card, value: card.value * 2 };
            this.state.currentStreak.push(doubledCard);
         }
         // Non-coin cards (power, cutthroat) drawn during High Seas are just added normally
         // (This is an edge case in Full Plunder deck)
         if (card.type === 'power') {
            const player = this.currentPlayer();
            if (player.heldCards.length < 3) {
               player.heldCards.push(card);
            }
         }
         if (card.type === 'cutthroat') {
            // Cutthroat drawn during High Seas — add to streak at double value
            const doubledCard: Card = { ...card, value: card.value * 2 };
            this.state.currentStreak.push(doubledCard);
         }
      }

      this.state.isHighSeasActive = false;
      this.state.highSeasCardsRemaining = 0;
      this.state.highSeasCardsDrawn = [];
      this.state.turnPhase = 'drawing';
   }

   /**
    * Finish the game (deck is empty).
    * If the last card is not a pirate, the current streak is banked.
    */
   private finishGame(lastCard: Card): void {
      this.state.isGameOver = true;
      this.state.phase = 'finished';

      if (lastCard.type !== 'pirate') {
         // Bank the current streak + the last card (if it was a coin)
         const player = this.currentPlayer();
         const streakSum = this.calculateStreakValue();

         // The last card was already added to the streak in handleCoinDraw,
         // so just sum the whole streak
         player.coins += streakSum;
      }
      // If last card was pirate, streak is lost — existing scores stand

      // Determine winner
      const sortedPlayers = [...this.state.players].sort((a, b) => b.coins - a.coins);
      this.state.winner = sortedPlayers[0];
      this.state.currentStreak = [];
   }

   /**
    * Advance to the next player's turn. Clears streak and current card.
    */
   private advanceTurn(): void {
      const currentPlayer = this.currentPlayer();
      currentPlayer.hasTurn = false;

      const nextIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
      this.state.currentPlayerIndex = nextIndex;
      this.state.players[nextIndex].hasTurn = true;

      this.state.currentCard = null;
      this.state.currentStreak = [];
      this.state.turnPhase = 'drawing';

      // Reset any per-turn power states
      this.state.isHighSeasActive = false;
      this.state.highSeasCardsRemaining = 0;
      this.state.highSeasCardsDrawn = [];
      this.state.pendingCutthroatCard = null;
      this.state.peekCard = null;
      this.state.lastPirateBlocked = false;
   }

   /**
    * Create an empty initial state (before a game starts).
    */
   private createEmptyState(): GameState {
      return {
         phase: 'playing',
         deck: [],
         originalDeckSize: 0,
         cardsPlayed: 0,
         players: [],
         currentPlayerIndex: 0,
         currentCard: null,
         currentStreak: [],
         isGameOver: false,
         winner: null,
         turnPhase: 'drawing',
         isHighSeasActive: false,
         highSeasCardsRemaining: 0,
         highSeasCardsDrawn: [],
         shieldActive: false,
         doubleDownActive: false,
         peekCard: null,
         pendingCutthroatCard: null,
         lastPirateBlocked: false,
      };
   }

   /**
    * Fisher-Yates shuffle for an array (non-mutating).
    */
   private shuffleArray<T>(arr: T[]): T[] {
      const shuffled = [...arr];
      let currentIndex = shuffled.length;
      while (currentIndex !== 0) {
         const randomIndex = Math.floor(Math.random() * currentIndex);
         currentIndex--;
         [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
      }
      return shuffled;
   }

   // ---- Serialization (for future multiplayer) ----

   /**
    * Serialize the game state to a JSON-safe object.
    */
   serialize(): string {
      return JSON.stringify(this.state);
   }

   /**
    * Restore game state from a serialized string.
    */
   static deserialize(json: string): GameEngine {
      const engine = new GameEngine();
      engine.state = JSON.parse(json);
      return engine;
   }
}
