'use server';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { applyAction, findGameByCode, isUserInGame, parseEngineState } from '@/server/game-room';
import { db } from '@/server/db/client';
import { gamePlayers, users } from '@/server/db/schema';
import { MAX_PLAYERS } from '@/game/rules';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

export type JoinRoomResult = { ok: true; code: string } | { ok: false; error: string };

export async function joinRoom(input: z.input<typeof InputSchema>): Promise<JoinRoomResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid room code' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) });
   if (!profile) return { ok: false, error: 'Profile missing' };

   const game = await findGameByCode(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };

   if (await isUserInGame(game.id, user.id)) {
      return { ok: true, code: parsed.data.code };
   }

   if (game.status !== 'lobby') return { ok: false, error: 'Game already started' };

   const state = parseEngineState(game);
   if (state.players.length >= MAX_PLAYERS) return { ok: false, error: 'Room is full' };

   try {
      await applyAction(
         game.id,
         { type: 'PLAYER_JOIN', player: { id: user.id, name: profile.displayName } },
         'PLAYER_JOIN',
         {
            actorId: user.id,
            code: parsed.data.code,
            onPlayers: async (tx, gameId, next) => {
               const seat = next.players.length - 1;
               await tx
                  .insert(gamePlayers)
                  .values({
                     gameId,
                     userId: user.id,
                     seat,
                     displayName: profile.displayName,
                  })
                  .onConflictDoNothing();
            },
         },
      );
   } catch (err) {
      console.error('joinRoom failed', err);
      return { ok: false, error: 'Failed to join room' };
   }

   return { ok: true, code: parsed.data.code };
}

export async function leaveRoom(code: string): Promise<{ ok: boolean }> {
   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false };

   const game = await findGameByCode(code.toUpperCase());
   if (!game) return { ok: false };
   if (game.status !== 'lobby') return { ok: false };

   try {
      await db.transaction(async (tx) => {
         await tx
            .delete(gamePlayers)
            .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)));
      });
      await applyAction(game.id, { type: 'PLAYER_LEAVE', playerId: user.id }, 'PLAYER_LEAVE', {
         actorId: user.id,
         code: game.code as string,
      });
   } catch (err) {
      console.error('leaveRoom failed', err);
      return { ok: false };
   }

   return { ok: true };
}
