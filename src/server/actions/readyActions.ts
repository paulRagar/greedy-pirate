'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { applyAction, fetchSpectators, findGameByCode, parseEngineState } from '@/server/game-room';
import { broadcastRoomState } from '@/server/realtime/broadcast';
import { db } from '@/server/db/client';
import { gamePlayers } from '@/server/db/schema';
import { toPublic } from '@/game/public';
import { BOARDING_COUNTDOWN_MS, MIN_PLAYERS } from '@/game/rules';
import { getSupabaseServer } from '@/server/supabase/server';

export type ReadyResult = { ok: true; deadline?: string } | { ok: false; error: string };

const CodeSchema = z.object({ code: z.string().trim().toUpperCase().length(4) });
const SetReadySchema = CodeSchema.extend({ ready: z.boolean() });

/** Seated user ids in this game currently flagged ready. */
async function getReadyIds(gameId: string): Promise<string[]> {
   const rows = await db
      .select({ userId: gamePlayers.userId })
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, gameId), isNotNull(gamePlayers.readyAt)));
   return rows.map((r) => r.userId).filter((id): id is string => !!id);
}

/**
 * Re-publish the current lobby state on the room topic, carrying the ready set
 * (and optionally a boarding deadline). Versionless — it advances nothing, just
 * refreshes auxiliary lobby info for everyone.
 */
async function broadcastLobby(
   gameId: string,
   code: string,
   actorId: string,
   eventType: string,
   extra: { boardingDeadline?: string } = {},
): Promise<void> {
   const game = await findGameByCode(code);
   if (!game) return;
   const [spectators, readyIds] = await Promise.all([
      fetchSpectators(db, gameId),
      getReadyIds(gameId),
   ]);
   await broadcastRoomState(code, {
      state: toPublic(parseEngineState(game)),
      spectators,
      actorId,
      eventType,
      readyIds,
      ...extra,
   });
}

/** Toggle the caller's ready flag in the lobby and broadcast the new ready set. */
export async function setReady(input: { code: string; ready: boolean }): Promise<ReadyResult> {
   const parsed = SetReadySchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findGameByCode(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.status !== 'lobby') return { ok: false, error: 'Game already started' };

   const seated = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)),
   });
   if (!seated) return { ok: false, error: 'Only seated crew can ready up' };

   await db
      .update(gamePlayers)
      .set({ readyAt: parsed.data.ready ? new Date() : null })
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)));

   await broadcastLobby(game.id, game.code as string, user.id, 'READY_CHANGED');
   return { ok: true };
}

/**
 * Host kicks off the boarding countdown when the crew isn't all ready yet.
 * Broadcasts the absolute deadline so every client shows the same timer; the
 * host's client finalizes (all-ready → start, or deadline → drop the unready).
 */
export async function beginBoarding(input: { code: string }): Promise<ReadyResult> {
   const parsed = CodeSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findGameByCode(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.status !== 'lobby') return { ok: false, error: 'Game already started' };
   if (game.hostId !== user.id) return { ok: false, error: 'Only the captain can set sail' };

   const deadline = new Date(Date.now() + BOARDING_COUNTDOWN_MS).toISOString();
   await broadcastLobby(game.id, game.code as string, user.id, 'BOARDING_STARTED', {
      boardingDeadline: deadline,
   });
   return { ok: true, deadline };
}

/**
 * Drop every unready crewmate (never the captain) and start the game. Called by
 * the host's client when the boarding countdown expires. Refuses if too few
 * ready crew remain, so the captain isn't stranded in an unstartable game.
 */
export async function startGameDroppingUnready(input: { code: string }): Promise<ReadyResult> {
   const parsed = CodeSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findGameByCode(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.status !== 'lobby') return { ok: true }; // already sailed — idempotent
   if (game.hostId !== user.id) return { ok: false, error: 'Only the captain can set sail' };

   const seats = await db.query.gamePlayers.findMany({
      where: eq(gamePlayers.gameId, game.id),
      columns: { userId: true, readyAt: true },
   });
   const unready = seats.filter((s) => s.userId && s.userId !== game.hostId && !s.readyAt);
   if (seats.length - unready.length < MIN_PLAYERS) {
      return { ok: false, error: `Need at least ${MIN_PLAYERS} ready crew to sail` };
   }

   try {
      // Mirror leaveRoom: delete the seat row, then reduce PLAYER_LEAVE so the
      // engine roster matches before we shuffle.
      for (const seat of unready) {
         await db
            .delete(gamePlayers)
            .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, seat.userId!)));
         await applyAction(
            game.id,
            { type: 'PLAYER_LEAVE', playerId: seat.userId! },
            'PLAYER_LEAVE',
            { actorId: user.id, code: game.code as string },
         );
      }
      const result = await applyAction(
         game.id,
         { type: 'START_GAME', seed: randomUUID(), variant: game.deckVariant },
         'START_GAME',
         { actorId: user.id, code: game.code as string },
      );
      if (result.next.players.length < MIN_PLAYERS) {
         return { ok: false, error: `Need at least ${MIN_PLAYERS} players` };
      }
   } catch (err) {
      console.error('startGameDroppingUnready failed', err);
      return { ok: false, error: 'Failed to start game' };
   }

   return { ok: true };
}
