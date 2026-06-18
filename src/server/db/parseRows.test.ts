import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseRows } from './parseRows';

// Mirrors the cron cleanup boundary: a SQL function returning counts.
const PruneRow = z.object({ prune_old_events: z.number() });

describe('parseRows', () => {
   it('accepts rows matching the schema', () => {
      const rows = parseRows([{ prune_old_events: 3 }], PruneRow);
      expect(rows).toEqual([{ prune_old_events: 3 }]);
   });

   it('throws loudly when a returned column is renamed (no silent NaN)', () => {
      // Simulates a SQL function whose return column was renamed: the old
      // name is gone, so the value would have been `undefined` → Number() → NaN.
      expect(() => parseRows([{ pruned_events: 3 }], PruneRow)).toThrow();
   });

   it('throws when a column type drifts (string where a number is expected)', () => {
      expect(() => parseRows([{ prune_old_events: '3' }], PruneRow)).toThrow();
   });

   it('throws when the result is not an array of rows', () => {
      expect(() => parseRows({ prune_old_events: 3 }, PruneRow)).toThrow(
         /expected an array/,
      );
   });

   it('returns an empty array for no rows', () => {
      expect(parseRows([], PruneRow)).toEqual([]);
   });
});
