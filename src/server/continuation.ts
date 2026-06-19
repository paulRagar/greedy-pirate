import 'server-only';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { db } from './db/client';
import { gamePlayers, games } from './db/schema';
import type { ContinuationState } from './realtime/broadcast';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

export const CONTINUATION_WINDOW_MS = 30_000;

/**
 * Read the continuation context for a room. Returns null whenever the
 * room is outside the continuation window (not yet completed, finalized
 * already, or no deadline stamped).
 */
export async function fetchContinuation(
   client: DbOrTx,
   gameId: string,
): Promise<ContinuationState> {
   const row = await client.query.games.findFirst({
      where: eq(games.id, gameId),
      columns: { continuationDeadline: true, continuationFinalized: true },
   });
   if (!row?.continuationDeadline || row.continuationFinalized) return null;

   const seated = await client.query.gamePlayers.findMany({
      where: eq(gamePlayers.gameId, gameId),
      columns: { userId: true, continuedAt: true, joinedAt: true },
      orderBy: [asc(gamePlayers.joinedAt)],
   });

   const seatedIds = seated
      .map((r) => r.userId)
      .filter((id): id is string => id !== null);

   const continuedIds = seated
      .filter((r) => r.continuedAt !== null)
      .sort((a, b) => (a.continuedAt!.getTime() ?? 0) - (b.continuedAt!.getTime() ?? 0))
      .map((r) => r.userId)
      .filter((id): id is string => id !== null);

   return {
      deadlineAt: row.continuationDeadline.toISOString(),
      continuedIds,
      seatedIds,
   };
}
