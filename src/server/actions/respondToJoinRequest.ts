'use server';

import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gameJoinRequests, gameSpectators, games, users } from '@/server/db/schema';
import { parseEngineState } from '@/server/game-room';
import { seatPlayerInRoom } from '@/server/joinFlow';
import {
   broadcastKnockResolved,
   broadcastRoomState,
} from '@/server/realtime/broadcast';
import { fetchSpectators } from '@/server/spectators';
import { toPublic } from '@/game/public';
import { MAX_PLAYERS } from '@/game/rules';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   requestId: z.string().uuid(),
   approve: z.boolean(),
});

export type RespondResult = { ok: true } | { ok: false; error: string };

export async function respondToJoinRequest(
   input: z.input<typeof InputSchema>,
): Promise<RespondResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const request = await db.query.gameJoinRequests.findFirst({
      where: eq(gameJoinRequests.id, parsed.data.requestId),
   });
   if (!request) return { ok: false, error: 'Hail not found' };
   if (request.status !== 'pending') return { ok: false, error: 'Hail already resolved' };
   if (request.expiresAt < new Date()) {
      // Stale — let the cron mark expired, but reject the host action cleanly.
      return { ok: false, error: 'Hail expired' };
   }

   const game = await db.query.games.findFirst({ where: eq(games.id, request.gameId) });
   if (!game?.code) return { ok: false, error: 'Room not found' };
   if (game.hostId !== user.id) return { ok: false, error: 'Only the captain may respond' };
   if (game.status !== 'lobby' && game.status !== 'active') {
      return { ok: false, error: 'Voyage already over' };
   }

   if (!parsed.data.approve) {
      await db
         .update(gameJoinRequests)
         .set({ status: 'denied', resolvedAt: new Date() })
         .where(eq(gameJoinRequests.id, request.id));
      await broadcastKnockResolved({
         requestId: request.id,
         requesterId: request.userId,
         outcome: 'denied',
      });
      return { ok: true };
   }

   // Look up the requester's current display name. The knock row carries
   // a snapshot from knock time, but the user may have renamed since
   // (e.g., via the post-admission rename prompt). Always seat with the
   // latest name to avoid stale labels in the lobby.
   const requester = await db.query.users.findFirst({
      where: eq(users.id, request.userId),
      columns: { displayName: true },
   });
   const currentDisplayName = requester?.displayName ?? request.displayName;

   // Approve path. Re-verify the seat / spectator constraints inside the
   // same tx that flips the request to 'approved' so a slow click can't
   // double-seat or over-fill.
   if (request.kind === 'player') {
      if (game.status !== 'lobby') return { ok: false, error: 'Game already underway' };
      const state = parseEngineState(game);
      if (state.players.length >= MAX_PLAYERS) {
         await db
            .update(gameJoinRequests)
            .set({ status: 'denied', resolvedAt: new Date() })
            .where(eq(gameJoinRequests.id, request.id));
         await broadcastKnockResolved({
            requestId: request.id,
            requesterId: request.userId,
            outcome: 'denied',
         });
         return { ok: false, error: 'Ship filled while ye decided' };
      }
      const seatResult = await seatPlayerInRoom(game, {
         id: request.userId,
         displayName: currentDisplayName,
      });
      if (!seatResult.ok) {
         return {
            ok: false,
            error: seatResult.error === 'full' ? 'Ship is full' : 'Failed to seat boarder',
         };
      }
      await db
         .update(gameJoinRequests)
         .set({ status: 'approved', resolvedAt: new Date() })
         .where(and(eq(gameJoinRequests.id, request.id), eq(gameJoinRequests.status, 'pending')));
      await broadcastKnockResolved({
         requestId: request.id,
         requesterId: request.userId,
         outcome: 'approved',
      });
      return { ok: true };
   }

   // Spectator approval — insert spectator row, broadcast room state.
   await db
      .insert(gameSpectators)
      .values({
         gameId: game.id,
         userId: request.userId,
         displayName: currentDisplayName,
      })
      .onConflictDoNothing();
   await db
      .update(gameJoinRequests)
      .set({ status: 'approved', resolvedAt: new Date() })
      .where(and(eq(gameJoinRequests.id, request.id), eq(gameJoinRequests.status, 'pending')));

   const state = parseEngineState(game);
   const spectators = await fetchSpectators(db, game.id);
   await broadcastRoomState(game.code, {
      state: toPublic(state),
      spectators,
      actorId: user.id,
      eventType: 'SPECTATOR_JOIN',
   });
   await broadcastKnockResolved({
      requestId: request.id,
      requesterId: request.userId,
      outcome: 'approved',
   });
   return { ok: true };
}

