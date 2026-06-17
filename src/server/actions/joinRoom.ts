'use server';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { applyAction, findGameByCode, isUserInGame, parseEngineState } from '@/server/game-room';
import { seatPlayerInRoom } from '@/server/joinFlow';
import { db } from '@/server/db/client';
import { gamePlayers, games, users } from '@/server/db/schema';
import { broadcastLobbyEvent } from '@/server/realtime/broadcast';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

export type JoinRoomResult =
   | { ok: true; code: string }
   | { ok: false; error: string; needsKnock?: boolean };

/**
 * Fast-path direct join for public rooms in 'lobby' status. Private rooms
 * MUST go through requestJoin (knock flow). Active or completed games
 * route the player to the spectator path on the room page.
 */
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

   if (game.status !== 'lobby') return { ok: true, code: parsed.data.code };

   if (!game.isPublic) {
      return { ok: false, error: 'Captain must approve boarding', needsKnock: true };
   }

   const result = await seatPlayerInRoom(game, { id: user.id, displayName: profile.displayName });
   if (!result.ok) {
      return { ok: false, error: result.error === 'full' ? 'Ship is full' : 'Failed to board' };
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

   // Auto-close empty rooms. A lobby with 0 seated players is a ghost ship —
   // hard-delete so the games table stays bounded. Cascades clear any
   // residual join requests / events. Stats already aggregated in
   // user_stats on game completion, so abandoned/lobby rows lose nothing.
   const refreshed = await findGameByCode(code.toUpperCase());
   if (refreshed) {
      const state = parseEngineState(refreshed);
      if (state.players.length === 0) {
         await db.delete(games).where(eq(games.id, refreshed.id));
         if (refreshed.isPublic && refreshed.code) {
            await broadcastLobbyEvent({ type: 'room_removed', code: refreshed.code });
         }
      }
   }

   return { ok: true };
}
