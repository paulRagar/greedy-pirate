import 'server-only';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from './db/client';
import { gamePlayers, gameSpectators } from './db/schema';
import type { RoomSpectator } from './realtime/broadcast';
import type { Player } from '@/game/types';
import { MAX_PLAYERS } from '@/game/rules';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

export async function fetchSpectators(client: DbOrTx, gameId: string): Promise<RoomSpectator[]> {
   const rows = await client.query.gameSpectators.findMany({
      where: eq(gameSpectators.gameId, gameId),
      orderBy: [asc(gameSpectators.joinedAt)],
   });
   return rows.map((row) => ({ id: row.userId, name: row.displayName }));
}

/**
 * On restart, promote spectators (FIFO by joinedAt) into open player seats
 * until either the spectator queue empties or the table hits MAX_PLAYERS.
 *
 * Returns the players to carry forward (existing seated + freshly promoted).
 * Caller is responsible for writing this list into the new engine state and
 * keeping the gamePlayers table in sync.
 */
export async function promoteSpectators(
   tx: Tx,
   gameId: string,
   seatedPlayers: ReadonlyArray<Player>,
): Promise<ReadonlyArray<Player>> {
   const open = MAX_PLAYERS - seatedPlayers.length;
   if (open <= 0) return seatedPlayers;

   const queue = await tx.query.gameSpectators.findMany({
      where: eq(gameSpectators.gameId, gameId),
      orderBy: [asc(gameSpectators.joinedAt)],
      limit: open,
   });
   if (queue.length === 0) return seatedPlayers;

   const promoted: Player[] = [...seatedPlayers];
   let nextSeat = await nextAvailableSeat(tx, gameId, seatedPlayers.length);
   const promotedIds: string[] = [];
   for (const row of queue) {
      promoted.push({ id: row.userId, name: row.displayName, coins: 0 });
      await tx.insert(gamePlayers).values({
         gameId,
         userId: row.userId,
         seat: nextSeat,
         displayName: row.displayName,
      });
      promotedIds.push(row.userId);
      nextSeat += 1;
   }

   await tx
      .delete(gameSpectators)
      .where(and(eq(gameSpectators.gameId, gameId), inArray(gameSpectators.userId, promotedIds)));

   return promoted;
}

async function nextAvailableSeat(tx: Tx, gameId: string, hint: number): Promise<number> {
   const rows = await tx.query.gamePlayers.findMany({
      where: eq(gamePlayers.gameId, gameId),
      orderBy: [asc(gamePlayers.seat)],
      columns: { seat: true },
   });
   const used = new Set(rows.map((r) => r.seat));
   // Fall back to the hint if seats are dense (the common case).
   if (!used.has(hint)) return hint;
   let candidate = 0;
   while (used.has(candidate)) candidate += 1;
   return candidate;
}
