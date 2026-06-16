'use server';

import 'server-only';
import { and, eq, gte, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gamePlayers, games, users } from '@/server/db/schema';
import { parseEngineState } from '@/server/game-room';
import { broadcastRoomState } from '@/server/realtime/broadcast';
import { fetchSpectators } from '@/server/spectators';
import { fetchContinuation } from '@/server/continuation';
import { getSupabaseServer } from '@/server/supabase/server';
import { toPublic } from '@/game/public';

const TTL_MS = 60_000;

const PrepareSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

const ClaimSchema = z.object({
   token: z.string().uuid(),
});

export type PrepareSeatTransferResult =
   | { ok: true; token: string; expiresAt: string }
   | { ok: false; error: string };

/**
 * Issue a one-time token bound to the caller's seat in the given room.
 * The caller can hand this token to a follow-up sign-in/sign-up flow so
 * the new identity inherits the seat without re-knocking.
 */
export async function prepareSeatTransfer(
   input: z.input<typeof PrepareSchema>,
): Promise<PrepareSeatTransferResult> {
   const parsed = PrepareSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await db.query.games.findFirst({
      where: eq(games.code, parsed.data.code),
      columns: { id: true, status: true },
   });
   if (!game) return { ok: false, error: 'Room not found' };

   const seat = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)),
   });
   if (!seat) return { ok: false, error: 'No seat to transfer' };

   const token = crypto.randomUUID();
   const expiresAt = new Date(Date.now() + TTL_MS);
   await db
      .update(gamePlayers)
      .set({ transferToken: token, transferExpiresAt: expiresAt })
      .where(eq(gamePlayers.id, seat.id));

   return { ok: true, token, expiresAt: expiresAt.toISOString() };
}

export type ClaimSeatResult =
   | { ok: true; code: string }
   | { ok: false; error: string };

/**
 * Redeem a transfer token: rewrite the seat's user_id to the caller and
 * update the engine state JSON so the broadcast carries the new id. The
 * token is single-use and burns on success or expiry.
 */
export async function claimSeatByToken(
   input: z.input<typeof ClaimSchema>,
): Promise<ClaimSeatResult> {
   const parsed = ClaimSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid token' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const seat = await db.query.gamePlayers.findFirst({
      where: and(
         eq(gamePlayers.transferToken, parsed.data.token),
         isNotNull(gamePlayers.transferExpiresAt),
         gte(gamePlayers.transferExpiresAt, new Date()),
      ),
   });
   if (!seat) return { ok: false, error: 'Transfer token expired or unknown' };

   const game = await db.query.games.findFirst({ where: eq(games.id, seat.gameId) });
   if (!game?.code) return { ok: false, error: 'Room missing' };

   const previousUserId = seat.userId;
   if (previousUserId === user.id) {
      // Same identity (e.g. signup that claimed the anon account kept the
      // same auth user id). Just clear the token and treat as success.
      await db
         .update(gamePlayers)
         .set({ transferToken: null, transferExpiresAt: null })
         .where(eq(gamePlayers.id, seat.id));
      return { ok: true, code: game.code };
   }

   // Conflict check: if the new identity already holds a seat in this
   // room, we can't double-seat them. Bail and let the user pick.
   const existing = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, seat.gameId), eq(gamePlayers.userId, user.id)),
   });
   if (existing) {
      await db
         .update(gamePlayers)
         .set({ transferToken: null, transferExpiresAt: null })
         .where(eq(gamePlayers.id, seat.id));
      return { ok: false, error: 'That account is already aboard this voyage' };
   }

   // Fetch the new identity's current display name so the seat label
   // reflects who actually sits there now.
   const claimer = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { displayName: true },
   });
   const claimedName = claimer?.displayName ?? seat.displayName;

   await db.transaction(async (tx) => {
      await tx
         .update(gamePlayers)
         .set({
            userId: user.id,
            displayName: claimedName,
            transferToken: null,
            transferExpiresAt: null,
         })
         .where(eq(gamePlayers.id, seat.id));

      // Rewrite the player id + name inside the engine state JSON.
      const row = await tx.query.games.findFirst({ where: eq(games.id, seat.gameId) });
      if (!row) return;
      const state = parseEngineState(row);
      if (previousUserId && state.players.some((p) => p.id === previousUserId)) {
         const nextPlayers = state.players.map((p) =>
            p.id === previousUserId ? { ...p, id: user.id, name: claimedName } : p,
         );
         await tx
            .update(games)
            .set({
               state: {
                  players: nextPlayers,
                  turnIndex: state.turnIndex,
                  deck: state.deck,
                  currentCard: state.currentCard,
                  currentStreak: state.currentStreak,
                  pirateCount: state.pirateCount,
                  winnerId:
                     state.winnerId === previousUserId ? user.id : state.winnerId,
                  absentIds: state.absentIds.map((id) =>
                     id === previousUserId ? user.id : id,
                  ),
               },
               currentPlayerId:
                  row.currentPlayerId === previousUserId
                     ? user.id
                     : row.currentPlayerId,
               hostId: row.hostId === previousUserId ? user.id : row.hostId,
            })
            .where(eq(games.id, seat.gameId));
      }
   });

   // Broadcast so live clients pick up the new id immediately.
   const row = await db.query.games.findFirst({ where: eq(games.id, seat.gameId) });
   if (row?.code) {
      const state = parseEngineState(row);
      const spectators = await fetchSpectators(db, seat.gameId);
      const continuation = await fetchContinuation(db, seat.gameId);
      await broadcastRoomState(row.code, {
         state: toPublic(state),
         spectators,
         actorId: user.id,
         eventType: 'SEAT_TRANSFERRED',
         continuation,
      });
   }

   return { ok: true, code: game.code };
}
