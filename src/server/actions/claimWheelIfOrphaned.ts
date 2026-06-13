'use server';

import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gamePlayers, games } from '@/server/db/schema';
import { findCompletedOrActiveGame, parseEngineState } from '@/server/game-room';
import { fetchSpectators } from '@/server/spectators';
import { broadcastRoomState } from '@/server/realtime/broadcast';
import { toPublic } from '@/game/public';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

export type ClaimResult = { ok: true; claimed: boolean } | { ok: false; error: string };

const HOST_GONE_GRACE_MS = 30_000;

/**
 * Presence-driven backup for host migration. A seated client calls this
 * once it observes the captain has been offline past the grace window
 * (and host_left_at hasn't been set explicitly). The server promotes the
 * earliest-joined non-host sailor — provided the caller is that sailor.
 */
export async function claimWheelIfOrphaned(
   input: z.input<typeof InputSchema>,
): Promise<ClaimResult> {
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
      return { ok: true, claimed: false };
   }
   if (game.hostId === user.id) return { ok: true, claimed: false };

   if (!game.hostLeftAt) {
      // Best-effort: mark hostLeftAt now so the cron path also triggers
      // if the calling client disconnects before we promote.
      await db
         .update(games)
         .set({ hostLeftAt: new Date() })
         .where(and(eq(games.id, game.id), sql`${games.hostLeftAt} is null`));
      return { ok: true, claimed: false };
   }

   const millisGone = Date.now() - game.hostLeftAt.getTime();
   if (millisGone < HOST_GONE_GRACE_MS) return { ok: true, claimed: false };

   const successor = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), sql`${gamePlayers.userId} <> ${game.hostId}`),
      orderBy: [asc(gamePlayers.joinedAt)],
   });
   if (!successor || successor.userId !== user.id) {
      return { ok: true, claimed: false };
   }

   const updated = await db
      .update(games)
      .set({ hostId: user.id, hostLeftAt: null })
      .where(and(eq(games.id, game.id), eq(games.hostId, game.hostId)))
      .returning({ id: games.id });
   if (updated.length === 0) return { ok: true, claimed: false };

   const state = parseEngineState(game);
   const spectators = await fetchSpectators(db, game.id);
   await broadcastRoomState(parsed.data.code, {
      state: toPublic(state),
      spectators,
      actorId: user.id,
      eventType: 'HOST_CHANGED',
      hostId: user.id,
   });

   return { ok: true, claimed: true };
}
