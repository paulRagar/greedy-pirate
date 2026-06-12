'use server';

import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gameEvents, gamePlayers, games } from '@/server/db/schema';
import {
   broadcastRoomState,
   fetchSpectators,
   findCompletedOrActiveGame,
   loadRoomForUser,
   parseEngineState,
} from '@/server/game-room';
import { promoteSpectators } from '@/server/spectators';
import { getSupabaseServer } from '@/server/supabase/server';
import { initialState } from '@/game/engine';
import { toPublic } from '@/game/public';
import type { GameState, Player } from '@/game/types';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

export type RestartRoomResult = { ok: true } | { ok: false; error: string };

/**
 * Reset a completed (or active) room back to lobby state so the seated
 * crew can play again w/o sharing a new code. Host-only — other players
 * stay in their seats and the engine state is wiped to a fresh deck
 * keyed to the same variant. Triggers a broadcast so connected clients
 * reflect the reset.
 */
export async function restartRoom(input: z.input<typeof InputSchema>): Promise<RestartRoomResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid room code' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findCompletedOrActiveGame(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.hostId !== user.id) return { ok: false, error: 'Only the captain can play again' };

   // Confirm membership (loadRoomForUser throws on bad state).
   try {
      await loadRoomForUser(parsed.data.code, user.id);
   } catch {
      return { ok: false, error: 'Could not load room' };
   }

   const prev = parseEngineState(game);

   // Carry forward seated players (winner stats already booked when the
   // previous game completed; we don't double-count on restart).
   const seatedRows = await db.query.gamePlayers.findMany({
      where: eq(gamePlayers.gameId, game.id),
      orderBy: (table, { asc }) => [asc(table.seat)],
   });

   const carriedPlayers: Player[] = seatedRows
      .filter((row) => row.userId !== null)
      .map((row) => ({ id: row.userId as string, name: row.displayName, coins: 0 }));

   const { next, spectators } = await db.transaction(async (tx) => {
      // Wipe coins / winner flags on seated players so the lobby restart
      // shows everyone at zero.
      await tx
         .update(gamePlayers)
         .set({ coins: 0, isWinner: false, piratesEncountered: 0 })
         .where(eq(gamePlayers.gameId, game.id));

      // Promote FIFO spectators into open seats before the lobby resets,
      // so a late joiner from the previous round is already aboard when
      // the host hoists the colors again.
      const promotedPlayers = await promoteSpectators(tx, game.id, carriedPlayers);

      const next: GameState = {
         ...initialState,
         variant: prev.variant,
         players: [...promotedPlayers],
      };

      await tx
         .update(games)
         .set({
            status: 'lobby',
            state: {
               players: next.players,
               turnIndex: next.turnIndex,
               deck: next.deck,
               currentCard: next.currentCard,
               currentStreak: next.currentStreak,
               pirateCount: next.pirateCount,
               winnerId: next.winnerId,
               absentIds: next.absentIds,
            },
            startedAt: null,
            completedAt: null,
            currentPlayerId: null,
         })
         .where(eq(games.id, game.id));

      // New event row so the broadcast is consumable from the event log.
      const seqRow = await tx
         .select({ id: gameEvents.id })
         .from(gameEvents)
         .where(eq(gameEvents.gameId, game.id))
         .orderBy(gameEvents.seq);
      const seq = seqRow.length;

      await tx.insert(gameEvents).values({
         gameId: game.id,
         seq,
         actorId: user.id,
         type: 'RESTART',
         payload: { state: toPublic(next), actorId: user.id },
      });

      const remainingSpectators = await fetchSpectators(tx, game.id);
      return { next, spectators: remainingSpectators };
   });

   await broadcastRoomState(parsed.data.code, {
      state: toPublic(next),
      spectators,
      actorId: user.id,
      eventType: 'RESTART',
   });

   return { ok: true };
}

/**
 * Player who finds themselves the last connected member of an active
 * game can declare forfeit win. Server verifies actor is seated, game is
 * active, and the lobby of seated players is non-empty (defensive).
 */
const ForfeitSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

export async function endGameByForfeit(input: z.input<typeof ForfeitSchema>): Promise<RestartRoomResult> {
   const parsed = ForfeitSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid room code' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findCompletedOrActiveGame(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.status !== 'active') return { ok: false, error: 'Game is not active' };

   const seat = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)),
   });
   if (!seat) return { ok: false, error: 'Not a member' };

   const prev = parseEngineState(game);
   const winnerSeat = prev.players.find((p) => p.id === user.id) ?? null;
   if (!winnerSeat) return { ok: false, error: 'Not seated in the active game' };

   const next: GameState = {
      ...prev,
      status: 'complete',
      currentCard: null,
      currentStreak: [],
      winnerId: winnerSeat.id,
   };

   await db.transaction(async (tx) => {
      await tx
         .update(games)
         .set({
            status: 'complete',
            state: {
               players: next.players,
               turnIndex: next.turnIndex,
               deck: next.deck,
               currentCard: next.currentCard,
               currentStreak: next.currentStreak,
               pirateCount: next.pirateCount,
               winnerId: next.winnerId,
               absentIds: next.absentIds,
            },
            completedAt: new Date(),
            currentPlayerId: null,
         })
         .where(eq(games.id, game.id));

      await tx
         .update(gamePlayers)
         .set({ isWinner: true })
         .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)));

      const seqRow = await tx
         .select({ id: gameEvents.id })
         .from(gameEvents)
         .where(eq(gameEvents.gameId, game.id))
         .orderBy(gameEvents.seq);
      const seq = seqRow.length;

      await tx.insert(gameEvents).values({
         gameId: game.id,
         seq,
         actorId: user.id,
         type: 'FORFEIT_WIN',
         payload: { state: toPublic(next), actorId: user.id },
      });
   });

   const spectators = await fetchSpectators(db, game.id);
   await broadcastRoomState(parsed.data.code, {
      state: toPublic(next),
      spectators,
      actorId: user.id,
      eventType: 'FORFEIT_WIN',
   });

   return { ok: true };
}
