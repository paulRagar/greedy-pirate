'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { applyAction, findGameByCode } from '@/server/game-room';
import { getSupabaseServer } from '@/server/supabase/server';
import { MIN_PLAYERS } from '@/game/rules';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

export type StartGameResult = { ok: true } | { ok: false; error: string };

export async function startOnlineGame(input: z.input<typeof InputSchema>): Promise<StartGameResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findGameByCode(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.hostId !== user.id) return { ok: false, error: 'Only the host can start' };
   if (game.status !== 'lobby') return { ok: false, error: 'Game already started' };

   try {
      const seed = randomUUID();
      const result = await applyAction(
         game.id,
         { type: 'START_GAME', seed, variant: game.deckVariant },
         'START_GAME',
         { actorId: user.id, code: parsed.data.code },
      );
      if (result.next.players.length < MIN_PLAYERS) {
         return { ok: false, error: `Need at least ${MIN_PLAYERS} players` };
      }
   } catch (err) {
      console.error('startOnlineGame failed', err);
      return { ok: false, error: 'Failed to start game' };
   }

   return { ok: true };
}
