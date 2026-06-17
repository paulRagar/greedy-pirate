'use server';

import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gamePlayers, games } from '@/server/db/schema';
import { findCompletedOrActiveGame, parseEngineState } from '@/server/game-room';
import { broadcastLobbyEvent } from '@/server/realtime/broadcast';
import { passTheWheel } from './passTheWheel';
import { leaveRoom } from './joinRoom';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
   toUserId: z.string().uuid().optional(),
   // Client presence ids. The server uses these to recognize a captain
   // who is effectively alone — i.e., the DB still lists seats for
   // players whose tabs closed without firing the leave beacon. When
   // omitted, we fall back to engine state only.
   onlineIds: z.array(z.string().uuid()).optional(),
});

export type LeaveAsHostResult =
   | { ok: true }
   | { ok: false; mustNominate: true; candidates: Array<{ id: string; displayName: string }> }
   | { ok: false; error: string };

/**
 * The captain leaves. If there are other seated sailors, we either pass
 * the wheel to a nominated successor or stamp `host_left_at` so the
 * cleanup cron promotes the earliest joiner if they walk away without
 * choosing. Only-player-aboard case falls through to the normal leave.
 */
export async function leaveAsHost(
   input: z.input<typeof InputSchema>,
): Promise<LeaveAsHostResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findCompletedOrActiveGame(parsed.data.code);
   if (!game?.code) return { ok: false, error: 'Room not found' };
   if (game.hostId !== user.id) return { ok: false, error: 'Not the captain' };

   // Engine state is the screen's source of truth. The DB row can lag —
   // if a player's tab close beacon never lands, their gamePlayers row
   // persists even though PLAYER_LEAVE removed them from the engine.
   // Reconcile both: prune any DB row not represented in engine state,
   // then build the candidate list from what remains.
   const seatedIds = new Set(parseEngineState(game).players.map((p) => p.id));
   const allOthers = await db.query.gamePlayers.findMany({
      where: and(eq(gamePlayers.gameId, game.id), sql`${gamePlayers.userId} <> ${user.id}`),
      orderBy: gamePlayers.joinedAt,
   });
   const staleIds = allOthers
      .filter((row) => row.userId === null || !seatedIds.has(row.userId))
      .map((row) => row.id);
   if (staleIds.length > 0) {
      await db.delete(gamePlayers).where(inArray(gamePlayers.id, staleIds));
   }
   const engineOthers = allOthers.filter(
      (row) => row.userId !== null && seatedIds.has(row.userId),
   );

   // If the caller supplied presence ids, narrow further to crewmates
   // the host can actually still see online. Avoids the "stuck in
   // Pass-the-Wheel with no one to nominate" trap when other seats
   // belong to disconnected players.
   const presenceFilter = parsed.data.onlineIds
      ? new Set(parsed.data.onlineIds)
      : null;
   const others = presenceFilter
      ? engineOthers.filter((row) => row.userId !== null && presenceFilter.has(row.userId))
      : engineOthers;

   if (others.length === 0) {
      // Solo aboard — scuttle the ship. Marks the room abandoned outright
      // (vs. relying on PLAYER_LEAVE leaving the engine empty) so ghost
      // engine entries from disconnected players can't keep the room
      // alive after the captain leaves. Also drops the host's gamePlayer
      // row so it doesn't show up in Find Crew as orphaned.
      await db.transaction(async (tx) => {
         await tx
            .delete(gamePlayers)
            .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)));
         await tx
            .update(games)
            .set({ status: 'abandoned', hostLeftAt: new Date() })
            .where(eq(games.id, game.id));
      });
      if (game.isPublic && game.code) {
         await broadcastLobbyEvent({ type: 'room_removed', code: game.code });
      }
      return { ok: true };
   }

   if (parsed.data.toUserId) {
      const pass = await passTheWheel({
         code: parsed.data.code,
         toUserId: parsed.data.toUserId,
      });
      if (!pass.ok) return pass;
      if (game.status === 'lobby') {
         const left = await leaveRoom(parsed.data.code);
         if (!left.ok) return { ok: false, error: 'Failed to disembark' };
      }
      return { ok: true };
   }

   // No nomination supplied — let the caller force the modal. Surface the
   // candidate list so the UI can render it without a second roundtrip.
   const candidates = others.map((row) => ({
      id: row.userId as string,
      displayName: row.displayName,
   }));
   return { ok: false, mustNominate: true, candidates };
}
