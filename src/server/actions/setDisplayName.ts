'use server';

import { and, eq, ilike, ne } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { gamePlayers, games, users } from '@/server/db/schema';
import type { DbGame } from '@/server/db/schema';
import { broadcastRoomState } from '@/server/realtime/broadcast';
import { fetchSpectators } from '@/server/spectators';
import { fetchContinuation } from '@/server/continuation';
import { parseEngineState } from '@/server/game-room';
import { containsProfanity } from '@/server/profanity';
import { supabaseAdmin } from '@/server/supabase/admin';
import { getSupabaseServer } from '@/server/supabase/server';
import { toPublic } from '@/game/public';
import { validateDisplayName } from '@/lib/displayNameValidation';

export type SetDisplayNameResult = { ok: true; name: string } | { ok: false; error: string };

export async function setDisplayName(input: string): Promise<SetDisplayNameResult> {
   const validated = validateDisplayName(input);
   if (!validated.ok) return validated;

   const name = validated.name;
   if (containsProfanity(name)) {
      return { ok: false, error: 'Name not allowed. Try another.' };
   }

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) {
      return { ok: false, error: 'Not signed in' };
   }

   // Lobby seats this user holds — propagate the rename so the lobby UI
   // reflects reality without forcing a rejoin. Active/complete games keep
   // their snapshot frozen for stat integrity.
   const ownLobbyGames = await db
      .select({ id: games.id, code: games.code })
      .from(gamePlayers)
      .innerJoin(games, eq(gamePlayers.gameId, games.id))
      .where(and(eq(gamePlayers.userId, user.id), eq(games.status, 'lobby')));

   for (const room of ownLobbyGames) {
      const conflict = await db.query.gamePlayers.findFirst({
         where: and(
            eq(gamePlayers.gameId, room.id),
            ilike(gamePlayers.displayName, name),
            ne(gamePlayers.userId, user.id),
         ),
      });
      if (conflict) {
         return {
            ok: false,
            error: room.code
               ? `Name taken by another crewmate in room ${room.code}.`
               : 'Name taken by another crewmate in your room.',
         };
      }
   }

   await db.update(users).set({ displayName: name }).where(eq(users.id, user.id));

   await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { display_name: name },
   });

   for (const room of ownLobbyGames) {
      await db
         .update(gamePlayers)
         .set({ displayName: name })
         .where(and(eq(gamePlayers.gameId, room.id), eq(gamePlayers.userId, user.id)));

      const row = await db.query.games.findFirst({ where: eq(games.id, room.id) });
      if (!row?.code) continue;

      await rewritePlayerNameInState(row, user.id, name);
      await broadcastRoomAfterRename(row.id, user.id);
   }

   return { ok: true, name };
}

async function rewritePlayerNameInState(row: DbGame, userId: string, newName: string): Promise<void> {
   const state = parseEngineState(row);
   if (!state.players.some((p) => p.id === userId)) return;
   const nextPlayers = state.players.map((p) =>
      p.id === userId ? { ...p, name: newName } : p,
   );
   const serialized = {
      players: nextPlayers,
      turnIndex: state.turnIndex,
      deck: state.deck,
      currentCard: state.currentCard,
      currentStreak: state.currentStreak,
      pirateCount: state.pirateCount,
      winnerId: state.winnerId,
      absentIds: state.absentIds,
   };
   await db.update(games).set({ state: serialized }).where(eq(games.id, row.id));
}

async function broadcastRoomAfterRename(gameId: string, actorId: string): Promise<void> {
   const row = await db.query.games.findFirst({ where: eq(games.id, gameId) });
   if (!row?.code) return;
   const state = parseEngineState(row);
   const spectators = await fetchSpectators(db, gameId);
   const continuation = await fetchContinuation(db, gameId);
   await broadcastRoomState(row.code, {
      state: toPublic(state),
      spectators,
      actorId,
      eventType: 'NAME_CHANGED',
      continuation,
   });
}
