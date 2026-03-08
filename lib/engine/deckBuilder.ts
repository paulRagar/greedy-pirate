import { Card, DeckCardEntry, DeckConfig } from '@/types/game';

// ---- Deck Configurations ----

// Original deck: 10 pirates, 41 ones = 51 cards
export const standardDeckConfig: DeckConfig = {
   id: 'standard',
   name: 'Standard',
   description: 'The classic deck. Simple coins and pirates.',
   cards: [
      { type: 'pirate', value: 0, count: 10, name: 'Pirate' },
      { type: 'coin', value: 1, count: 41, name: 'Gold Coin' },
   ],
};

// Greedy deck: 10 pirates, coins 1-5 with weighted distribution = 51 cards
export const greedyDeckConfig: DeckConfig = {
   id: 'greedy',
   name: 'Greedy',
   description: 'Higher-value coins appear. Risk and reward increase.',
   cards: [
      { type: 'pirate', value: 0, count: 10, name: 'Pirate' },
      { type: 'coin', value: 1, count: 27, name: 'Gold Coin' },
      { type: 'coin', value: 2, count: 4, name: 'Gold Coin' },
      { type: 'coin', value: 3, count: 3, name: 'Gold Coin' },
      { type: 'coin', value: 4, count: 2, name: 'Gold Coin' },
      { type: 'coin', value: 5, count: 1, name: 'Gold Coin' },
   ],
};

// Super Greedy deck: 15 pirates, coins 1-10 with weighted distribution = 101 cards
export const superGreedyDeckConfig: DeckConfig = {
   id: 'superGreedy',
   name: 'Super Greedy',
   description: 'A massive deck with coins up to 10. More pirates, more treasure.',
   cards: [
      { type: 'pirate', value: 0, count: 15, name: 'Pirate' },
      { type: 'coin', value: 1, count: 47, name: 'Gold Coin' },
      { type: 'coin', value: 2, count: 8, name: 'Gold Coin' },
      { type: 'coin', value: 3, count: 6, name: 'Gold Coin' },
      { type: 'coin', value: 4, count: 4, name: 'Gold Coin' },
      { type: 'coin', value: 5, count: 2, name: 'Gold Coin' },
      { type: 'coin', value: 6, count: 2, name: 'Gold Coin' },
      { type: 'coin', value: 7, count: 2, name: 'Gold Coin' },
      { type: 'coin', value: 8, count: 2, name: 'Gold Coin' },
      { type: 'coin', value: 9, count: 2, name: 'Gold Coin' },
      { type: 'coin', value: 10, count: 1, name: 'Gold Coin' },
   ],
};

// Full Plunder deck: all card types including cutthroat and power cards
export const fullPlunderDeckConfig: DeckConfig = {
   id: 'fullPlunder',
   name: 'Full Plunder',
   description: 'The complete experience. Cutthroat steals, power cards, and High Seas await.',
   cards: [
      // Pirates (16)
      { type: 'pirate', value: 0, count: 16, name: 'Pirate' },
      // Coins (80)
      { type: 'coin', value: 1, count: 40, name: 'Gold Coin' },
      { type: 'coin', value: 2, count: 10, name: 'Gold Coin' },
      { type: 'coin', value: 3, count: 8, name: 'Gold Coin' },
      { type: 'coin', value: 4, count: 6, name: 'Gold Coin' },
      { type: 'coin', value: 5, count: 4, name: 'Gold Coin' },
      { type: 'coin', value: 6, count: 3, name: 'Gold Coin' },
      { type: 'coin', value: 7, count: 3, name: 'Gold Coin' },
      { type: 'coin', value: 8, count: 2, name: 'Gold Coin' },
      { type: 'coin', value: 9, count: 2, name: 'Gold Coin' },
      { type: 'coin', value: 10, count: 2, name: 'Gold Coin' },
      // Cutthroat cards (8)
      { type: 'cutthroat', value: 2, count: 2, name: 'Cutthroat', description: 'Steal 2 coins from another player.' },
      { type: 'cutthroat', value: 3, count: 3, name: 'Cutthroat', description: 'Steal 3 coins from another player.' },
      { type: 'cutthroat', value: 4, count: 2, name: 'Cutthroat', description: 'Steal 4 coins from another player.' },
      { type: 'cutthroat', value: 5, count: 1, name: 'Cutthroat', description: 'Steal 5 coins from another player.' },
      // Power cards (8)
      {
         type: 'power',
         value: 0,
         count: 2,
         name: 'Shield',
         description: 'Blocks the next pirate card. Your streak is safe.',
         powerEffect: 'shield',
      },
      {
         type: 'power',
         value: 0,
         count: 2,
         name: 'Peek',
         description: 'Reveal the top card of the deck without drawing it.',
         powerEffect: 'peek',
      },
      {
         type: 'power',
         value: 0,
         count: 2,
         name: 'Swap',
         description: 'Trade your banked coin total with another player.',
         powerEffect: 'swap',
      },
      {
         type: 'power',
         value: 0,
         count: 2,
         name: 'Double Down',
         description: 'The next coin card you draw is worth double.',
         powerEffect: 'doubleDown',
      },
   ],
};

// All available deck configs for the UI picker
export const allDeckConfigs: DeckConfig[] = [
   standardDeckConfig,
   greedyDeckConfig,
   superGreedyDeckConfig,
   fullPlunderDeckConfig,
];

// ---- Deck Builder ----

let cardIdCounter = 0;

function generateCardId(): string {
   cardIdCounter++;
   return `card-${cardIdCounter}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Builds a deck of Card objects from a DeckConfig.
 * Each card gets a unique ID for tracking.
 */
export function buildDeck(config: DeckConfig): Card[] {
   cardIdCounter = 0;
   const cards: Card[] = [];

   for (const entry of config.cards) {
      for (let i = 0; i < entry.count; i++) {
         const card: Card = {
            id: generateCardId(),
            type: entry.type,
            value: entry.value,
            name: entry.name || entry.type,
         };
         if (entry.description) card.description = entry.description;
         if (entry.powerEffect) card.powerEffect = entry.powerEffect;
         cards.push(card);
      }
   }

   return cards;
}

/**
 * Fisher-Yates shuffle. Returns a new shuffled array (does not mutate input).
 */
export function shuffleDeck(deck: Card[]): Card[] {
   const shuffled = [...deck];
   let currentIndex = shuffled.length;

   while (currentIndex !== 0) {
      const randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
   }

   return shuffled;
}

/**
 * Looks up a DeckConfig by its id string.
 */
export function getDeckConfigById(id: string): DeckConfig | undefined {
   return allDeckConfigs.find((config) => config.id === id);
}
