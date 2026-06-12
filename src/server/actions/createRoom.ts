'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { applyAction, createRoom as createRoomRow } from '@/server/game-room';
import { db } from '@/server/db/client';
import { gamePlayers, users } from '@/server/db/schema';
import { DECK_VARIANTS, DEFAULT_VARIANT } from '@/game/rules';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z
   .object({
      variant: z.enum(DECK_VARIANTS).optional(),
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
   const game = await createRoomRow({ hostId: user.id, variant });

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

   return { ok: true, code: game.code as string };
}
