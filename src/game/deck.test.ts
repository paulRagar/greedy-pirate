import { describe, expect, it } from 'vitest';
import { buildDeck, DECKS } from './deck';
import { createRng, seedFromString } from './shuffle';
import type { Card } from './types';

const rngFor = (seed: string) => createRng(seedFromString(seed));
const count = (deck: readonly Card[], kind: Card['kind']) =>
   deck.filter((c) => c.kind === kind).length;

describe('buildDeck — static variants', () => {
   it('returns the fixed array without consuming the RNG', () => {
      const a = buildDeck('greedy', rngFor('whatever'));
      expect(a).toEqual(DECKS.greedy);
   });
});

describe('buildDeck — cursed (randomized)', () => {
   it('is deterministic for a given seed', () => {
      const a = buildDeck('cursed', rngFor('same'));
      const b = buildDeck('cursed', rngFor('same'));
      expect(a).toEqual(b);
   });

   it('varies composition across seeds (anti-counting)', () => {
      const shapes = new Set<string>();
      for (const seed of ['s1', 's2', 's3', 's4', 's5', 's6']) {
         const d = buildDeck('cursed', rngFor(seed));
         shapes.add(`${d.length}:${count(d, 'pirate')}`);
      }
      // Across six seeds we expect more than one distinct (size, pirates) shape.
      expect(shapes.size).toBeGreaterThan(1);
   });

   it('stays within the designed bounds', () => {
      for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
         const d = buildDeck('cursed', rngFor(seed));
         const pirates = count(d, 'pirate');
         const gold = count(d, 'gold');
         expect(pirates).toBeGreaterThanOrEqual(9);
         expect(pirates).toBeLessThanOrEqual(13);
         expect(gold).toBeGreaterThanOrEqual(33);
         expect(gold).toBeLessThanOrEqual(43);
         // Only gold + pirates for now (special cards land in later tickets).
         expect(pirates + gold).toBe(d.length);
      }
   });
});
