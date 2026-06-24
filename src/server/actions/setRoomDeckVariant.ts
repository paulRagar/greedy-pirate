'use server';

import 'server-only';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { games } from '@/server/db/schema';
import { fetchSpectators, findGameByCode, parseEngineState } from '@/server/game-room';
import { broadcastRoomState } from '@/server/realtime/broadcast';
import { toPublic } from '@/game/public';
import { DECK_VARIANTS } from '@/game/rules';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
   variant: z.enum(DECK_VARIANTS),
});

export type SetDeckResult = { ok: true } | { ok: false; error: string };

/**
 * Captain picks the deck in the waiting room. `deck_variant` is the source of
 * truth for the engine's variant (see `parseEngineState`), so we update the
 * column and re-publish the lobby state versionlessly — every member's room
 * view (`state.variant`) updates live, and `startOnlineGame` reads the column.
 * Host-only, lobby-only.
 */
export async function setRoomDeckVariant(input: z.input<typeof InputSchema>): Promise<SetDeckResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findGameByCode(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.hostId !== user.id) return { ok: false, error: 'Only the captain can choose the deck' };
   if (game.status !== 'lobby') return { ok: false, error: 'Game already started' };
   if (game.deckVariant === parsed.data.variant) return { ok: true };

   await db.update(games).set({ deckVariant: parsed.data.variant }).where(eq(games.id, game.id));

   const fresh = await findGameByCode(parsed.data.code);
   if (fresh) {
      const spectators = await fetchSpectators(db, fresh.id);
      await broadcastRoomState(parsed.data.code, {
         state: toPublic(parseEngineState(fresh)),
         spectators,
         actorId: user.id,
         eventType: 'DECK_CHANGED',
      });
   }

   return { ok: true };
}
