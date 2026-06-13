'use server';

import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { applyAction, createRoom as createRoomRow } from '@/server/game-room';
import { db } from '@/server/db/client';
import { gamePlayers, games, users } from '@/server/db/schema';
import { DECK_VARIANTS, DEFAULT_VARIANT, MAX_PLAYERS } from '@/game/rules';
import { broadcastLobbyEvent } from '@/server/realtime/broadcast';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z
   .object({
      variant: z.enum(DECK_VARIANTS).optional(),
      isPublic: z.boolean().optional(),
   })
   .optional();

export type CreateRoomResult = { ok: true; code: string } | { ok: false; error: string };

export async function createRoom(input?: z.input<typeof InputSchema>): Promise<CreateRoomResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) });
   if (!profile) return { ok: false, error: 'Profile missing' };

   const variant = parsed.data?.variant ?? DEFAULT_VARIANT;
   const isPublic = parsed.data?.isPublic ?? false;

   // One open lobby per captain. Abandon any prior lobby this user hosts —
   // they may have "backed out" without explicitly leaving. Stale rooms
   // would otherwise sit in the Find Crew list until the 2h cron sweep.
   const stale = await db
      .update(games)
      .set({ status: 'abandoned' })
      .where(and(eq(games.hostId, user.id), eq(games.status, 'lobby')))
      .returning({ code: games.code, isPublic: games.isPublic });
   for (const row of stale) {
      if (row.code && row.isPublic) {
         await broadcastLobbyEvent({ type: 'room_removed', code: row.code });
      }
   }
   // Also drop the host's seat in those abandoned rooms so they don't show
   // as "still aboard" if anyone re-fetches the row.
   if (stale.length > 0) {
      await db.execute(sql`
         delete from public.game_players gp
         using public.games g
         where gp.game_id = g.id
           and g.host_id = ${user.id}
           and g.status = 'abandoned'
      `);
   }

   const game = await createRoomRow({ hostId: user.id, variant, isPublic });

   try {
      await applyAction(
         game.id,
         { type: 'PLAYER_JOIN', player: { id: user.id, name: profile.displayName } },
         'PLAYER_JOIN',
         {
            actorId: user.id,
            code: game.code as string,
            onPlayers: async (tx, gameId) => {
               await tx
                  .insert(gamePlayers)
                  .values({
                     gameId,
                     userId: user.id,
                     seat: 0,
                     displayName: profile.displayName,
                  })
                  .onConflictDoNothing();
            },
         },
      );
   } catch (err) {
      console.error('createRoom join failed', err);
      return { ok: false, error: 'Failed to seat host' };
   }

   if (isPublic) {
      await broadcastLobbyEvent({
         type: 'room_created',
         room: {
            code: game.code as string,
            hostDisplayName: profile.displayName,
            playerCount: 1,
            maxPlayers: MAX_PLAYERS,
            status: 'lobby',
            deckVariant: variant,
            createdAt: game.createdAt.toISOString(),
         },
      });
   }

   return { ok: true, code: game.code as string };
}
