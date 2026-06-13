import 'server-only';
import { asc, eq } from 'drizzle-orm';
import type { DbGame } from './db/schema';
import { gamePlayers } from './db/schema';
import { applyAction, parseEngineState } from './game-room';
import { db } from './db/client';
import { MAX_PLAYERS } from '@/game/rules';

export type SeatOutcome =
   | { ok: true }
   | { ok: false; error: 'full' | 'engine' };

/**
 * Insert a player into a lobby game. Caller has already validated that
 * the game is in 'lobby' status, the user isn't already seated, and (for
 * private rooms) approval was granted.
 */
export async function seatPlayerInRoom(
   game: DbGame,
   user: { id: string; displayName: string },
): Promise<SeatOutcome> {
   const state = parseEngineState(game);
   if (state.players.length >= MAX_PLAYERS) return { ok: false, error: 'full' };

   try {
      await applyAction(
         game.id,
         { type: 'PLAYER_JOIN', player: { id: user.id, name: user.displayName } },
         'PLAYER_JOIN',
         {
            actorId: user.id,
            code: (game.code as string) ?? undefined,
            onPlayers: async (tx, gameId) => {
               // Seat number is the smallest non-negative integer not in use
               // by an existing row. Engine player array order is unrelated
               // to DB seat assignment; using `players.length - 1` breaks
               // after any mid-lobby leave (the array shrinks but the
               // vacated seat number stays free).
               const taken = await tx.query.gamePlayers.findMany({
                  where: eq(gamePlayers.gameId, gameId),
                  orderBy: [asc(gamePlayers.seat)],
                  columns: { seat: true },
               });
               const used = new Set(taken.map((r) => r.seat));
               let seat = 0;
               while (used.has(seat)) seat += 1;

               await tx
                  .insert(gamePlayers)
                  .values({
                     gameId,
                     userId: user.id,
                     seat,
                     displayName: user.displayName,
                  })
                  .onConflictDoNothing();
            },
         },
      );
      return { ok: true };
   } catch (err) {
      console.error('seatPlayerInRoom failed', err);
      return { ok: false, error: 'engine' };
   }
}
