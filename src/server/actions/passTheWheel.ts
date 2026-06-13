'use server';

import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gameJoinRequests, gamePlayers, games } from '@/server/db/schema';
import { findCompletedOrActiveGame, parseEngineState } from '@/server/game-room';
import { fetchSpectators } from '@/server/spectators';
import {
   broadcastKnockRequested,
   broadcastRoomState,
} from '@/server/realtime/broadcast';
import { toPublic } from '@/game/public';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
   toUserId: z.string().uuid(),
});

export type PassWheelResult = { ok: true } | { ok: false; error: string };

/**
 * Hand the captain's hat to another seated player. The pending knock
 * inbox follows the captaincy — we re-emit each open knock so the new
 * host's UI picks them up immediately.
 */
export async function passTheWheel(
   input: z.input<typeof InputSchema>,
): Promise<PassWheelResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findCompletedOrActiveGame(parsed.data.code);
   if (!game?.code) return { ok: false, error: 'Room not found' };
   if (game.status !== 'lobby' && game.status !== 'active') {
      return { ok: false, error: 'Voyage already complete' };
   }
   if (game.hostId !== user.id) return { ok: false, error: 'Only the captain may pass the wheel' };
   if (parsed.data.toUserId === user.id) {
      return { ok: false, error: 'Ye already hold the wheel' };
   }

   const seat = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, parsed.data.toUserId)),
   });
   if (!seat) return { ok: false, error: 'That sailor is not aboard' };

   const updated = await db
      .update(games)
      .set({ hostId: parsed.data.toUserId, hostLeftAt: null })
      .where(and(eq(games.id, game.id), eq(games.hostId, user.id)))
      .returning({ id: games.id });
   if (updated.length === 0) {
      return { ok: false, error: 'No longer captain' };
   }

   const state = parseEngineState(game);
   const spectators = await fetchSpectators(db, game.id);
   await broadcastRoomState(parsed.data.code, {
      state: toPublic(state),
      spectators,
      actorId: user.id,
      eventType: 'HOST_CHANGED',
      hostId: parsed.data.toUserId,
   });

   // Rebroadcast pending knocks so the new host's inbox lights up.
   const openKnocks = await db.query.gameJoinRequests.findMany({
      where: and(
         eq(gameJoinRequests.gameId, game.id),
         eq(gameJoinRequests.status, 'pending'),
         sql`${gameJoinRequests.expiresAt} > now()`,
      ),
   });
   for (const k of openKnocks) {
      await broadcastKnockRequested(parsed.data.code, {
         requestId: k.id,
         requesterId: k.userId,
         displayName: k.displayName,
         kind: k.kind,
         expiresAt: k.expiresAt.toISOString(),
      });
   }

   return { ok: true };
}
