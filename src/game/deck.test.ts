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

   it('stays within the designed bounds and includes the special cards', () => {
      for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
         const d = buildDeck('cursed', rngFor(seed));
         const pirates = count(d, 'pirate');
         const gold = count(d, 'gold');
         expect(pirates).toBeGreaterThanOrEqual(9);
         expect(pirates).toBeLessThanOrEqual(13);
         expect(gold).toBeGreaterThanOrEqual(33);
         expect(gold).toBeLessThanOrEqual(43);
         // Special-card rarity: Spyglass 2–3, Monkey 1–2, Amulet/Doubloon/Davey 1 each.
         expect(count(d, 'spyglass')).toBeGreaterThanOrEqual(2);
         expect(count(d, 'spyglass')).toBeLessThanOrEqual(3);
         expect(count(d, 'monkey')).toBeGreaterThanOrEqual(1);
         expect(count(d, 'monkey')).toBeLessThanOrEqual(2);
         expect(count(d, 'amulet')).toBe(1);
         expect(count(d, 'multiplier')).toBe(1);
         expect(count(d, 'davey_jones')).toBe(1);
      }
   });
});
