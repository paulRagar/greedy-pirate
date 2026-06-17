'use server';

import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gamePlayers } from '@/server/db/schema';
import {
   findCompletedOrActiveGame,
   parseEngineState,
} from '@/server/game-room';
import { fetchSpectators } from '@/server/spectators';
import { broadcastRoomState } from '@/server/realtime/broadcast';
import { fetchContinuation } from '@/server/continuation';
import { toPublic } from '@/game/public';
import { getSupabaseServer } from '@/server/supabase/server';
import { finalizeContinuationCore } from '@/server/actions/finalizeContinuation';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

export type ContinueResult = { ok: true } | { ok: false; error: string };

/**
 * Player opts into the next round during the post-game continuation
 * window. Updates their game_players.continued_at + broadcasts so every
 * client (host inbox, fellow players) sees the new opt-in.
 */
export async function continueIntoNextRound(
   input: z.input<typeof InputSchema>,
): Promise<ContinueResult> {
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
   if (game.continuationFinalized) return { ok: false, error: 'Window closed' };
   if (game.continuationDeadline && game.continuationDeadline < new Date()) {
      return { ok: false, error: 'Too late, sailor' };
   }

   const seat = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)),
   });
   if (!seat) return { ok: false, error: 'Not aboard this ship' };
   if (seat.continuedAt) return { ok: true };

   await db
      .update(gamePlayers)
      .set({ continuedAt: new Date() })
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)));

   const state = parseEngineState(game);
   const spectators = await fetchSpectators(db, game.id);
   const continuation = await fetchContinuation(db, game.id);

   // Every seated player has opted in — skip the rest of the 60s wait
   // and finalize now. Atomic claim inside finalizeContinuationCore makes
   // concurrent last-clickers safe.
   const allIn =
      continuation !== null &&
      continuation.seatedIds.length > 0 &&
      continuation.continuedIds.length === continuation.seatedIds.length;
   if (allIn) {
      await finalizeContinuationCore(game.code, user.id, { force: true });
      return { ok: true };
   }

   await broadcastRoomState(game.code, {
      state: toPublic(state),
      spectators,
      actorId: user.id,
      eventType: 'CONTINUE_OPT_IN',
      continuation,
   });

   return { ok: true };
}

