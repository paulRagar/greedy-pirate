import type { Card, Deck, DeckVariant, GoldCard, PirateCard } from './types';

const GOLD = (value: number): GoldCard => ({ kind: 'gold', value });
const PIRATE: PirateCard = { kind: 'pirate' };

const repeat = <T>(item: T, n: number): T[] => Array.from({ length: n }, () => item);

const greedy: Deck = [...repeat<Card>(PIRATE, 10), ...repeat<Card>(GOLD(1), 37)];

const evenGreedier: Deck = [
   ...repeat<Card>(PIRATE, 10),
   ...repeat<Card>(GOLD(1), 27),
   ...repeat<Card>(GOLD(2), 4),
   ...repeat<Card>(GOLD(3), 3),
   ...repeat<Card>(GOLD(4), 2),
   GOLD(5),
];

const superGreedy: Deck = [
   ...repeat<Card>(PIRATE, 15),
   ...repeat<Card>(GOLD(1), 54),
   ...repeat<Card>(GOLD(2), 8),
   ...repeat<Card>(GOLD(3), 6),
   ...repeat<Card>(GOLD(4), 4),
   ...repeat<Card>(GOLD(5), 2),
   ...repeat<Card>(GOLD(6), 2),
   ...repeat<Card>(GOLD(7), 2),
   ...repeat<Card>(GOLD(8), 2),
   ...repeat<Card>(GOLD(9), 2),
   GOLD(10),
];

export const DECKS: Readonly<Record<DeckVariant, Deck>> = {
   greedy,
   even_greedier: evenGreedier,
   super_greedy: superGreedy,
};
