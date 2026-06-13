'use server';

import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gamePlayers, games } from '@/server/db/schema';
import { findCompletedOrActiveGame } from '@/server/game-room';
import { passTheWheel } from './passTheWheel';
import { leaveRoom } from './joinRoom';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
   toUserId: z.string().uuid().optional(),
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

   const others = await db.query.gamePlayers.findMany({
      where: and(eq(gamePlayers.gameId, game.id), sql`${gamePlayers.userId} <> ${user.id}`),
      orderBy: gamePlayers.joinedAt,
   });

   if (others.length === 0) {
      // Solo host — normal leave. In lobby this removes the row + applies
      // PLAYER_LEAVE; abandon_stale_games will clean the orphan up later.
      if (game.status === 'lobby') {
         const res = await leaveRoom(parsed.data.code);
         return res.ok ? { ok: true } : { ok: false, error: 'Leave failed' };
      }
      // Active solo game shouldn't be possible (min 2 players), but
      // mark host as gone so cron tidies up.
      await db
         .update(games)
         .set({ hostLeftAt: new Date() })
         .where(eq(games.id, game.id));
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
   const candidates = others
      .filter((row) => row.userId !== null)
      .map((row) => ({ id: row.userId as string, displayName: row.displayName }));
   return { ok: false, mustNominate: true, candidates };
}
