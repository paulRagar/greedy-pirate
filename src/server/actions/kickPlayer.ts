'use server';

import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gamePlayers } from '@/server/db/schema';
import { applyAction, findGameByCode } from '@/server/game-room';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
   userId: z.string().uuid(),
});

export type KickResult = { ok: true } | { ok: false; error: string };

/**
 * Host removes another player from the lobby. Active-game kicks aren't
 * supported yet — the engine's PLAYER_LEAVE asserts lobby status, and
 * yanking a seated player mid-game would orphan their coins / turn slot.
 * If we need it, add a PLAYER_BOOT engine action that also runs SKIP_TURN.
 */
export async function kickPlayer(input: z.input<typeof InputSchema>): Promise<KickResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findGameByCode(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.hostId !== user.id) return { ok: false, error: 'Only the captain may boot crew' };
   if (game.status !== 'lobby') {
      return { ok: false, error: 'Cannot walk the plank once the voyage has begun' };
   }
   if (parsed.data.userId === user.id) return { ok: false, error: 'Cannot boot yourself' };

   const target = await db.query.gamePlayers.findFirst({
      where: and(
         eq(gamePlayers.gameId, game.id),
         eq(gamePlayers.userId, parsed.data.userId),
      ),
   });
   if (!target) return { ok: false, error: 'They are not aboard' };

   try {
      await db
         .delete(gamePlayers)
         .where(
            and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, parsed.data.userId)),
         );
      // applyAction broadcasts the new state; the kicked client detects it
      // is no longer in state.players and routes itself out.
      await applyAction(
         game.id,
         { type: 'PLAYER_LEAVE', playerId: parsed.data.userId },
         'PLAYER_LEAVE',
         { actorId: user.id, code: game.code as string },
      );
   } catch (err) {
      console.error('kickPlayer failed', err);
      return { ok: false, error: 'Failed to walk the plank' };
   }

   return { ok: true };
}
