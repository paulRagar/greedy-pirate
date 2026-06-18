'use server';

import 'server-only';
import { and, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { parseRows } from '@/server/db/parseRows';
import {
   gameJoinRequests,
   gamePlayers,
   gameSpectators,
   users,
} from '@/server/db/schema';
import { findCompletedOrActiveGame, parseEngineState } from '@/server/game-room';
import { seatPlayerInRoom } from '@/server/joinFlow';
import {
   broadcastKnockRequested,
   broadcastRoomState,
} from '@/server/realtime/broadcast';
import { fetchSpectators } from '@/server/spectators';
import { toPublic } from '@/game/public';
import { MAX_PLAYERS } from '@/game/rules';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
   kind: z.enum(['player', 'spectator']),
});

const KNOCK_TTL_SECONDS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

export type RequestJoinResult =
   | { ok: true; status: 'seated' | 'spectating' }
   | { ok: true; status: 'pending'; requestId: string; expiresAt: string }
   | { ok: false; error: string };

/**
 * Single entry point for boarding a room. Public lobby rooms seat the
 * player immediately; public active games drop them into the spectator
 * row. Private rooms (lobby or active) create a knock row and broadcast
 * a notification so the captain can approve or deny.
 */
export async function requestJoin(
   input: z.input<typeof InputSchema>,
): Promise<RequestJoinResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) });
   if (!profile) return { ok: false, error: 'Profile missing' };

   const game = await findCompletedOrActiveGame(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.status !== 'lobby' && game.status !== 'active') {
      return { ok: false, error: 'Voyage already complete' };
   }
   if (game.hostId === user.id) return { ok: false, error: 'You captain this ship' };

   const seated = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)),
   });
   if (seated) return { ok: true, status: 'seated' };

   const watching = await db.query.gameSpectators.findFirst({
      where: and(eq(gameSpectators.gameId, game.id), eq(gameSpectators.userId, user.id)),
   });
   if (watching) return { ok: true, status: 'spectating' };

   const wantsPlayer = parsed.data.kind === 'player';
   if (wantsPlayer && game.status !== 'lobby') {
      return { ok: false, error: 'Game already underway — spectate instead' };
   }
   if (!wantsPlayer && game.status === 'lobby') {
      return { ok: false, error: 'Game has not started — board as a player instead' };
   }

   // Public fast-path: skip knock entirely.
   if (game.isPublic) {
      if (wantsPlayer) {
         const seatResult = await seatPlayerInRoom(game, {
            id: user.id,
            displayName: profile.displayName,
         });
         if (!seatResult.ok) {
            return {
               ok: false,
               error: seatResult.error === 'full' ? 'Ship is full' : 'Failed to board',
            };
         }
         return { ok: true, status: 'seated' };
      }
      // Spectator on a public active game — direct add, no knock.
      await db
         .insert(gameSpectators)
         .values({
            gameId: game.id,
            userId: user.id,
            displayName: profile.displayName,
         })
         .onConflictDoNothing();
      const state = parseEngineState(game);
      const spectators = await fetchSpectators(db, game.id);
      await broadcastRoomState(parsed.data.code, {
         state: toPublic(state),
         spectators,
         actorId: user.id,
         eventType: 'SPECTATOR_JOIN',
      });
      return { ok: true, status: 'spectating' };
   }

   // Private room — knock flow. Pre-check capacity for players so a doomed
   // knock fails fast.
   if (wantsPlayer) {
      const state = parseEngineState(game);
      if (state.players.length >= MAX_PLAYERS) return { ok: false, error: 'Ship is full' };
   }

   // Rate-limit: cap total knocks per user over a rolling window.
   const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
   const recentRows = parseRows(
      await db.execute(
         sql`select count(*)::int as count from public.game_join_requests where user_id = ${user.id} and created_at > ${since.toISOString()}`,
      ),
      z.object({ count: z.number() }),
   );
   const recentCount = recentRows[0]?.count ?? 0;
   if (recentCount >= RATE_LIMIT_MAX) {
      return { ok: false, error: 'Easy, sailor — too many hails. Wait a minute.' };
   }

   // Insert the knock. The partial-unique index enforces one-pending-per-room.
   const expiresAt = new Date(Date.now() + KNOCK_TTL_SECONDS * 1000);
   let inserted;
   try {
      const rows = await db
         .insert(gameJoinRequests)
         .values({
            gameId: game.id,
            userId: user.id,
            displayName: profile.displayName,
            kind: parsed.data.kind,
            expiresAt,
         })
         .returning({ id: gameJoinRequests.id, expiresAt: gameJoinRequests.expiresAt });
      inserted = rows[0];
   } catch (err) {
      // Unique violation → an open knock already exists; surface that.
      if (typeof err === 'object' && err && 'code' in err && (err as { code: unknown }).code === '23505') {
         const existing = await db.query.gameJoinRequests.findFirst({
            where: and(
               eq(gameJoinRequests.gameId, game.id),
               eq(gameJoinRequests.userId, user.id),
               eq(gameJoinRequests.status, 'pending'),
            ),
         });
         if (existing) {
            return {
               ok: true,
               status: 'pending',
               requestId: existing.id,
               expiresAt: existing.expiresAt.toISOString(),
            };
         }
      }
      console.error('requestJoin insert failed', err);
      return { ok: false, error: 'Failed to hail the captain' };
   }
   if (!inserted) return { ok: false, error: 'Failed to hail the captain' };

   await broadcastKnockRequested(parsed.data.code, {
      requestId: inserted.id,
      requesterId: user.id,
      displayName: profile.displayName,
      kind: parsed.data.kind,
      expiresAt: inserted.expiresAt.toISOString(),
   });

   return {
      ok: true,
      status: 'pending',
      requestId: inserted.id,
      expiresAt: inserted.expiresAt.toISOString(),
   };
}
