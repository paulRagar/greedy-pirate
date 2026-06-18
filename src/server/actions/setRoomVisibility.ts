'use server';

import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gameJoinRequests, games, users } from '@/server/db/schema';
import { findCompletedOrActiveGame, parseEngineState } from '@/server/game-room';
import {
   broadcastKnockResolved,
   broadcastLobbyEvent,
} from '@/server/realtime/broadcast';
import { MAX_PLAYERS } from '@/game/rules';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
   isPublic: z.boolean(),
});

export type SetVisibilityResult = { ok: true } | { ok: false; error: string };

/**
 * Host toggles room visibility. Going private mass-denies any pending
 * knocks (simpler than re-asking the captain about each). Going public
 * surfaces the room on the lobby feed.
 */
export async function setRoomVisibility(
   input: z.input<typeof InputSchema>,
): Promise<SetVisibilityResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findCompletedOrActiveGame(parsed.data.code);
   if (!game?.code) return { ok: false, error: 'Room not found' };
   if (game.hostId !== user.id) return { ok: false, error: 'Only the captain may set the colors' };
   if (game.status !== 'lobby' && game.status !== 'active') {
      return { ok: false, error: 'Voyage already complete' };
   }
   if (game.isPublic === parsed.data.isPublic) return { ok: true };

   await db
      .update(games)
      .set({ isPublic: parsed.data.isPublic })
      .where(eq(games.id, game.id));

   if (!parsed.data.isPublic) {
      const denied = await db
         .update(gameJoinRequests)
         .set({ status: 'denied', resolvedAt: new Date() })
         .where(
            and(
               eq(gameJoinRequests.gameId, game.id),
               eq(gameJoinRequests.status, 'pending'),
               sql`${gameJoinRequests.expiresAt} > now()`,
            ),
         )
         .returning({ id: gameJoinRequests.id, userId: gameJoinRequests.userId });
      for (const row of denied) {
         await broadcastKnockResolved({
            requestId: row.id,
            requesterId: row.userId,
            outcome: 'denied',
         });
      }
      await broadcastLobbyEvent({ type: 'room_removed', code: game.code });
   } else {
      const host = await db.query.users.findFirst({ where: eq(users.id, game.hostId) });
      const state = parseEngineState(game);
      await broadcastLobbyEvent({
         type: 'room_created',
         room: {
            code: game.code,
            hostDisplayName: host?.displayName ?? 'Captain',
            playerCount: state.players.length,
            maxPlayers: MAX_PLAYERS,
            status: game.status as 'lobby' | 'active',
            deckVariant: game.deckVariant,
            createdAt: game.createdAt.toISOString(),
         },
      });
   }

   return { ok: true };
}
