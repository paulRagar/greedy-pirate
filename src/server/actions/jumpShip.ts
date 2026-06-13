'use server';

import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gamePlayers, games } from '@/server/db/schema';
import {
   findCompletedOrActiveGame,
   parseEngineState,
} from '@/server/game-room';
import { fetchSpectators, promoteSpectators } from '@/server/spectators';
import {
   broadcastLobbyEvent,
   broadcastRoomState,
} from '@/server/realtime/broadcast';
import { fetchContinuation } from '@/server/continuation';
import { toPublic } from '@/game/public';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

export type JumpShipResult = { ok: true } | { ok: false; error: string };

/**
 * Player opts OUT during the post-game continuation window. We delete
 * their game_players row but keep the engine's frozen end-of-game player
 * list untouched — that's what drives the VictoryModal for everyone
 * still on the scoreboard view. Continuation tracks who's still aboard
 * separately via seatedIds.
 */
export async function jumpShip(input: z.input<typeof InputSchema>): Promise<JumpShipResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid room code' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findCompletedOrActiveGame(parsed.data.code);
   if (!game?.code) return { ok: false, error: 'Room not found' };
   if (game.status !== 'complete') return { ok: false, error: 'No continuation window' };

   const seat = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)),
   });
   if (!seat) return { ok: true };

   const wasHost = game.hostId === user.id;
   const code = game.code;

   const { spectators, continuation, abandoned, newHostId } = await db.transaction(
      async (tx) => {
         await tx
            .delete(gamePlayers)
            .where(
               and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)),
            );

         // Reassign captain immediately if they bailed — pick the earliest-
         // joined survivor so the continuation lobby has a leader.
         let newHostId: string | undefined;
         if (wasHost) {
            const successor = await tx.query.gamePlayers.findFirst({
               where: eq(gamePlayers.gameId, game.id),
               orderBy: [asc(gamePlayers.joinedAt)],
            });
            if (successor?.userId) {
               newHostId = successor.userId;
               await tx
                  .update(games)
                  .set({ hostId: successor.userId, hostLeftAt: null })
                  .where(eq(games.id, game.id));
            }
         }

         // Top off with a FIFO spectator into the freed seat. We do NOT
         // touch engine.state.players — that's frozen as the end-of-game
         // snapshot driving VictoryModal everywhere.
         const remaining = await tx.query.gamePlayers.findMany({
            where: eq(gamePlayers.gameId, game.id),
            orderBy: [asc(gamePlayers.joinedAt)],
         });
         const seatedPlayers = remaining
            .filter((r) => r.userId !== null)
            .map((r) => ({ id: r.userId as string, name: r.displayName, coins: 0 }));
         await promoteSpectators(tx, game.id, seatedPlayers);

         // Determine abandonment AFTER spectator promotion runs.
         const finalCount = await tx.query.gamePlayers.findMany({
            where: eq(gamePlayers.gameId, game.id),
            columns: { id: true },
         });

         let abandoned = false;
         if (finalCount.length === 0) {
            await tx
               .update(games)
               .set({ status: 'abandoned', continuationFinalized: true })
               .where(eq(games.id, game.id));
            abandoned = true;
         }

         const spectators = await fetchSpectators(tx, game.id);
         const continuation = await fetchContinuation(tx, game.id);
         return { spectators, continuation, abandoned, newHostId };
      },
   );

   const engineState = parseEngineState(game);

   if (abandoned) {
      if (game.isPublic) {
         await broadcastLobbyEvent({ type: 'room_removed', code });
      }
      await broadcastRoomState(code, {
         state: toPublic(engineState),
         spectators,
         actorId: user.id,
         eventType: 'ROOM_ABANDONED',
         continuation: null,
      });
      return { ok: true };
   }

   await broadcastRoomState(code, {
      state: toPublic(engineState),
      spectators,
      actorId: user.id,
      eventType: 'JUMP_SHIP',
      continuation,
      hostId: newHostId ?? game.hostId,
   });

   return { ok: true };
}
