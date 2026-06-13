'use server';

import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gameJoinRequests } from '@/server/db/schema';
import { findCompletedOrActiveGame } from '@/server/game-room';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

export type PendingKnock = {
   requestId: string;
   requesterId: string;
   displayName: string;
   kind: 'player' | 'spectator';
   expiresAt: string;
};

export type ListPendingKnocksResult =
   | { ok: true; knocks: PendingKnock[] }
   | { ok: false; error: string };

/**
 * Host-only — hydrate the KnockInbox after refresh / host-change so
 * pending hails aren't lost behind the broadcast wave.
 */
export async function listPendingKnocks(
   input: z.input<typeof InputSchema>,
): Promise<ListPendingKnocksResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findCompletedOrActiveGame(parsed.data.code);
   if (!game?.code) return { ok: false, error: 'Room not found' };
   if (game.hostId !== user.id) return { ok: false, error: 'Only the captain' };

   const rows = await db.query.gameJoinRequests.findMany({
      where: and(
         eq(gameJoinRequests.gameId, game.id),
         eq(gameJoinRequests.status, 'pending'),
         sql`${gameJoinRequests.expiresAt} > now()`,
      ),
      orderBy: [asc(gameJoinRequests.createdAt)],
   });
   return {
      ok: true,
      knocks: rows.map((r) => ({
         requestId: r.id,
         requesterId: r.userId,
         displayName: r.displayName,
         kind: r.kind,
         expiresAt: r.expiresAt.toISOString(),
      })),
   };
}
