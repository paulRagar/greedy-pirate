import type { Rng } from './shuffle';
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

/** Static variants — fixed composition every game. */
type StaticVariant = Exclude<DeckVariant, 'cursed'>;

export const DECKS: Readonly<Record<StaticVariant, Deck>> = {
   greedy,
   even_greedier: evenGreedier,
   super_greedy: superGreedy,
};

// ── Cursed Seas: randomized composition ──────────────────────────────────────
// Unlike the static variants, the Cursed Seas deck is *generated per game* from
// the seeded RNG, with pirate count, gold count, and total size all varying
// within bounds. The point is anti-counting: a player can never tally the
// pirates drawn against a known deck to deduce what's left. Special cards slot
// in here as their tickets land (each is rare); for now the deck is gold +
// pirates with a randomized shape.

/** Inclusive integer in [min, max] drawn from the seeded RNG. */
function randInt(rng: Rng, min: number, max: number): number {
   return min + Math.floor(rng() * (max - min + 1));
}

/** Weighted gold value: mostly 1s, the occasional richer coin. */
function randomGoldValue(rng: Rng): number {
   const r = rng();
   if (r < 0.6) return 1;
   if (r < 0.8) return 2;
   if (r < 0.92) return 3;
   if (r < 0.98) return 4;
   return 5;
}

function buildCursedDeck(rng: Rng): Deck {
   const pirates = randInt(rng, 9, 13);
   const goldCount = randInt(rng, 33, 43);
   const cards: Card[] = [...repeat<Card>(PIRATE, pirates)];
   for (let i = 0; i < goldCount; i++) cards.push(GOLD(randomGoldValue(rng)));
   // Special cards are appended by later card tickets, then the whole deck is
   // shuffled by the caller — so position never depends on insertion order.
   return cards;
}

/**
 * The deck a game starts with for `variant`, given the game's seeded RNG.
 * Static variants ignore the RNG (fixed array); `cursed` consumes it to
 * randomize its composition. The caller shuffles the result.
 */
export function buildDeck(variant: DeckVariant, rng: Rng): Deck {
   if (variant === 'cursed') return buildCursedDeck(rng);
   return DECKS[variant];
}
