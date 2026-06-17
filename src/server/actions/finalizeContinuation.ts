'use server';

import 'server-only';
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gameEvents, gamePlayers, games } from '@/server/db/schema';
import {
   findCompletedOrActiveGame,
   parseEngineState,
} from '@/server/game-room';
import { fetchSpectators, promoteSpectators } from '@/server/spectators';
import {
   broadcastLobbyEvent,
   broadcastRoomState,
} from '@/server/realtime/broadcast';
import { initialState } from '@/game/engine';
import { toPublic } from '@/game/public';
import type { GameState, Player } from '@/game/types';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

export type FinalizeResult = { ok: true; finalized: boolean } | { ok: false; error: string };

/**
 * End the 60-second continuation window. Called by ANY client when its
 * local countdown hits zero — idempotent so a thundering herd is safe.
 * Players who never clicked Continue walk the plank. Whoever's left
 * carries forward into a fresh lobby. If the captain didn't opt in,
 * the earliest-joined survivor takes the wheel.
 */
export async function finalizeContinuation(
   input: z.input<typeof InputSchema>,
): Promise<FinalizeResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid room code' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   return finalizeContinuationCore(parsed.data.code, user.id);
}



/**
 * Auth-free finalize entry point for the cron sweep. The HTTP route
 * already authorized via CRON_SECRET; here we just need the game code
 * and an actor id for the event log + broadcast actor.
 */
export async function finalizeContinuationCore(
   roomCode: string,
   actorId: string,
   opts: { force?: boolean } = {},
): Promise<FinalizeResult> {
   const game = await findCompletedOrActiveGame(roomCode);
   if (!game?.code) return { ok: false, error: 'Room not found' };
   if (game.status !== 'complete') return { ok: true, finalized: false };
   if (game.continuationFinalized) return { ok: true, finalized: false };

   const deadline = game.continuationDeadline;
   if (!opts.force && deadline && deadline.getTime() > Date.now()) {
      return { ok: false, error: 'Window still open' };
   }

   // Atomic claim. If another client got here first, we no-op.
   const claimed = await db
      .update(games)
      .set({ continuationFinalized: true })
      .where(
         and(eq(games.id, game.id), eq(games.continuationFinalized, false)),
      )
      .returning({ id: games.id });
   if (claimed.length === 0) return { ok: true, finalized: false };

   const code = game.code;

   const result = await db.transaction(async (tx) => {
      const continuedRows = await tx.query.gamePlayers.findMany({
         where: and(eq(gamePlayers.gameId, game.id), isNotNull(gamePlayers.continuedAt)),
         orderBy: [asc(gamePlayers.joinedAt)],
      });
      const hesitantRows = await tx.query.gamePlayers.findMany({
         where: and(eq(gamePlayers.gameId, game.id), isNull(gamePlayers.continuedAt)),
      });

      // Plank-walk hesitators.
      for (const row of hesitantRows) {
         await tx
            .delete(gamePlayers)
            .where(
               and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, row.userId as string)),
            );
      }

      // No survivors → abandon the ship.
      if (continuedRows.length === 0) {
         await tx
            .update(games)
            .set({ status: 'abandoned', continuationDeadline: null })
            .where(eq(games.id, game.id));
         return {
            kind: 'abandoned' as const,
            isPublic: game.isPublic,
            plankedIds: hesitantRows
               .map((r) => r.userId)
               .filter((id): id is string => id !== null),
         };
      }

      // Captain bailout? Promote earliest-joined survivor.
      let hostId = game.hostId;
      const captainAboard = continuedRows.some((r) => r.userId === hostId);
      if (!captainAboard) {
         const successor = continuedRows[0];
         if (successor?.userId) {
            hostId = successor.userId;
            await tx
               .update(games)
               .set({ hostId, hostLeftAt: null })
               .where(eq(games.id, game.id));
         }
      }

      // Reset coins / flags on survivors so the next lobby starts fresh.
      await tx
         .update(gamePlayers)
         .set({ coins: 0, isWinner: false, piratesEncountered: 0, continuedAt: null })
         .where(eq(gamePlayers.gameId, game.id));

      const carried: Player[] = continuedRows
         .filter((row) => row.userId !== null)
         .map((row) => ({ id: row.userId as string, name: row.displayName, coins: 0 }));

      // Top off with FIFO spectators into any seats freed by hesitators.
      const finalPlayers = await promoteSpectators(tx, game.id, carried);

      const fresh: GameState = {
         ...initialState,
         variant: game.deckVariant as GameState['variant'],
         players: [...finalPlayers],
      };

      await tx
         .update(games)
         .set({
            status: 'lobby',
            state: {
               players: fresh.players,
               turnIndex: fresh.turnIndex,
               deck: fresh.deck,
               currentCard: fresh.currentCard,
               currentStreak: fresh.currentStreak,
               pirateCount: fresh.pirateCount,
               winnerId: fresh.winnerId,
               absentIds: fresh.absentIds,
            },
            startedAt: null,
            completedAt: null,
            continuationDeadline: null,
            currentPlayerId: null,
         })
         .where(eq(games.id, game.id));

      const seqRow = await tx
         .select({ id: gameEvents.id })
         .from(gameEvents)
         .where(eq(gameEvents.gameId, game.id))
         .orderBy(gameEvents.seq);
      const seq = seqRow.length;
      await tx.insert(gameEvents).values({
         gameId: game.id,
         seq,
         actorId,
         type: 'CONTINUATION_FINALIZED',
         payload: { state: toPublic(fresh), actorId },
      });

      const spectators = await fetchSpectators(tx, game.id);
      return {
         kind: 'restarted' as const,
         next: fresh,
         spectators,
         hostId,
         hostChanged: hostId !== game.hostId,
         isPublic: game.isPublic,
         plankedIds: hesitantRows
            .map((r) => r.userId)
            .filter((id): id is string => id !== null),
      };
   });

   if (result.kind === 'abandoned') {
      if (result.isPublic) {
         await broadcastLobbyEvent({ type: 'room_removed', code });
      }
      // Use the final-game state so clients still see scores in the
      // background while the abandonment modal fires. The ROOM_ABANDONED
      // eventType is the routing signal.
      const finalState = parseEngineState(game);
      await broadcastRoomState(code, {
         state: toPublic(finalState),
         spectators: [],
         actorId,
         eventType: 'ROOM_ABANDONED',
         continuation: null,
      });
      return { ok: true, finalized: true };
   }

   // Restart broadcast — clients see a fresh lobby state with the new
   // captain baked into the payload (avoids the router.refresh roundtrip).
   await broadcastRoomState(code, {
      state: toPublic(result.next),
      spectators: result.spectators,
      actorId,
      eventType: 'CONTINUATION_FINALIZED',
      continuation: null,
      hostId: result.hostId,
   });

   return { ok: true, finalized: true };
}
