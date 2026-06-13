'use server';

import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gameJoinRequests, games } from '@/server/db/schema';
import { broadcastKnockCancelled } from '@/server/realtime/broadcast';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   requestId: z.string().uuid(),
});

export type CancelJoinResult = { ok: true } | { ok: false; error: string };

/**
 * Knocker rescinds an unanswered hail. The host's KnockInbox listens for
 * the broadcast and removes the toast.
 */
export async function cancelJoinRequest(
   input: z.input<typeof InputSchema>,
): Promise<CancelJoinResult> {
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
   if (request.userId !== user.id) return { ok: false, error: 'Not your hail' };
   if (request.status !== 'pending') return { ok: true };

   await db
      .update(gameJoinRequests)
      .set({ status: 'cancelled', resolvedAt: new Date() })
      .where(and(eq(gameJoinRequests.id, request.id), eq(gameJoinRequests.status, 'pending')));

   const game = await db.query.games.findFirst({ where: eq(games.id, request.gameId) });
   if (game?.code) {
      await broadcastKnockCancelled(game.code, {
         requestId: request.id,
         requesterId: user.id,
      });
   }

   return { ok: true };
}
