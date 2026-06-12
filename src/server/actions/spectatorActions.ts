'use server';

import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gamePlayers, gameSpectators, users } from '@/server/db/schema';
import {
   broadcastRoomState,
   fetchSpectators,
   findCompletedOrActiveGame,
   parseEngineState,
} from '@/server/game-room';
import { toPublic } from '@/game/public';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

export type SpectatorResult = { ok: true } | { ok: false; error: string };

/**
 * Join an in-progress (or just-completed) room as a spectator. No engine
 * state mutation; just a row in game_spectators and a broadcast so the
 * roster updates for everyone watching.
 */
export async function joinAsSpectator(input: z.input<typeof InputSchema>): Promise<SpectatorResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid room code' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) });
   if (!profile) return { ok: false, error: 'Profile missing' };

   const game = await findCompletedOrActiveGame(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.status === 'lobby') {
      return { ok: false, error: 'Game has not started — join as a player instead' };
   }
   if (game.hostId === user.id) return { ok: false, error: 'Captain cannot spectate own ship' };

   const seated = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)),
   });
   if (seated) return { ok: false, error: 'You are already aboard as a player' };

   try {
      await db
         .insert(gameSpectators)
         .values({ gameId: game.id, userId: user.id, displayName: profile.displayName })
         .onConflictDoNothing();
   } catch (err) {
      console.error('joinAsSpectator failed', err);
      return { ok: false, error: 'Failed to join as spectator' };
   }

   const [state, spectators] = await Promise.all([
      Promise.resolve(parseEngineState(game)),
      fetchSpectators(db, game.id),
   ]);
   await broadcastRoomState(parsed.data.code, {
      state: toPublic(state),
      spectators,
      actorId: user.id,
      eventType: 'SPECTATOR_JOIN',
   });

   return { ok: true };
}

export async function leaveSpectator(input: z.input<typeof InputSchema>): Promise<SpectatorResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid room code' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findCompletedOrActiveGame(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };

   await db
      .delete(gameSpectators)
      .where(and(eq(gameSpectators.gameId, game.id), eq(gameSpectators.userId, user.id)));

   const state = parseEngineState(game);
   const spectators = await fetchSpectators(db, game.id);
   await broadcastRoomState(parsed.data.code, {
      state: toPublic(state),
      spectators,
      actorId: user.id,
      eventType: 'SPECTATOR_LEAVE',
   });

   return { ok: true };
}
