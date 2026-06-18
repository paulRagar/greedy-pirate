import 'server-only';
import type { z } from 'zod';

/**
 * Validate raw-SQL result rows at the boundary.
 *
 * `db.execute<T>(...)` does NOT check `T` against the columns Postgres
 * actually returns — every callsite casts `as unknown as T[]`, so a renamed
 * column in a SQL function stays green in TypeScript and surfaces as
 * `undefined` (then silently `Number(undefined) → NaN`) at runtime.
 *
 * Pass the awaited `db.execute(...)` result through here with a Zod row
 * schema so a shape mismatch throws a parse error instead of producing
 * NaN/undefined counts. Same boundary discipline as Zod on server-action input.
 */
export function parseRows<T>(result: unknown, rowSchema: z.ZodType<T>): T[] {
   if (!Array.isArray(result)) {
      throw new Error('parseRows: expected an array of result rows');
   }
   return result.map((row) => rowSchema.parse(row));
}
