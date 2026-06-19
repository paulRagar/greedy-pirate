'use server';

import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { friendships, gamePlayers, roomInvites, users } from '@/server/db/schema';
import { findCompletedOrActiveGame, parseEngineState } from '@/server/game-room';
import { seatPlayerInRoom } from '@/server/joinFlow';
import { broadcastRoomInvite } from '@/server/realtime/broadcast';
import { canonicalPair } from '@/server/friends';
import { isBlockedEitherWay } from '@/server/actions/friendActions';
import { getSupabaseServer } from '@/server/supabase/server';
import { MAX_PLAYERS } from '@/game/rules';

async function requireUser(): Promise<{ id: string } | null> {
   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   return user ? { id: user.id } : null;
}

async function areFriends(a: string, b: string): Promise<boolean> {
   const pair = canonicalPair(a, b);
   const row = await db.query.friendships.findFirst({
      where: and(eq(friendships.userLow, pair.low), eq(friendships.userHigh, pair.high)),
   });
   return Boolean(row);
}

export type InviteResult = { ok: true } | { ok: false; error: string };

const InviteSchema = z.object({
   friendId: z.string().uuid(),
   code: z.string().trim().toUpperCase().length(4),
});

/**
 * Invite a friend into the room you're currently in. Records a short-lived
 * invite (so they can bypass the knock) and pings them on their user:{id} topic.
 */
export async function inviteFriendToRoom(
   input: z.input<typeof InviteSchema>,
): Promise<InviteResult> {
   const parsed = InviteSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };
   const { friendId, code } = parsed.data;

   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };
   if (friendId === me.id) return { ok: false, error: 'You are already aboard' };

   const profile = await db.query.users.findFirst({ where: eq(users.id, me.id) });
   if (!profile) return { ok: false, error: 'Profile missing' };

   const game = await findCompletedOrActiveGame(code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.status !== 'lobby') return { ok: false, error: 'Voyage already underway' };

   // Caller must be in the room (host or seated).
   const meSeated = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, me.id)),
   });
   if (game.hostId !== me.id && !meSeated) {
      return { ok: false, error: 'You are not in this room' };
   }

   if (!(await areFriends(me.id, friendId))) return { ok: false, error: 'Not your friend' };
   if (await isBlockedEitherWay(me.id, friendId)) return { ok: false, error: 'Could not invite' };

   const friendSeated = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, friendId)),
   });
   if (friendSeated) return { ok: false, error: 'Already aboard' };

   const state = parseEngineState(game);
   if (state.players.length >= MAX_PLAYERS) return { ok: false, error: 'Ship is full' };

   // One pending invite per (room, friend) — the partial unique index dedupes.
   await db
      .insert(roomInvites)
      .values({ gameId: game.id, fromUserId: me.id, toUserId: friendId })
      .onConflictDoNothing();

   await broadcastRoomInvite(friendId, {
      code,
      fromUserId: me.id,
      fromDisplayName: profile.displayName,
      isPublic: game.isPublic,
   });

   return { ok: true };
}

export type AcceptInviteResult =
   | { ok: true; code: string }
   | { ok: false; error: string };

const AcceptSchema = z.object({ code: z.string().trim().toUpperCase().length(4) });

/**
 * Redeem a pending room invite: seat the invitee directly (bypassing the knock).
 * Returns ok:false with no fatal error if there's no live invite, so the caller
 * can fall back to the normal join/knock flow.
 */
export async function acceptRoomInvite(
   input: z.input<typeof AcceptSchema>,
): Promise<AcceptInviteResult> {
   const parsed = AcceptSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };
   const { code } = parsed.data;

   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };

   const profile = await db.query.users.findFirst({ where: eq(users.id, me.id) });
   if (!profile) return { ok: false, error: 'Profile missing' };

   const game = await findCompletedOrActiveGame(code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.status !== 'lobby') return { ok: false, error: 'Voyage already underway' };

   // Already aboard — nothing to do.
   const seated = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, me.id)),
   });
   if (seated) return { ok: true, code };

   const invite = await db.query.roomInvites.findFirst({
      where: and(
         eq(roomInvites.gameId, game.id),
         eq(roomInvites.toUserId, me.id),
         eq(roomInvites.status, 'pending'),
         sql`${roomInvites.expiresAt} > now()`,
      ),
   });
   if (!invite) return { ok: false, error: 'Invite expired' };

   const seat = await seatPlayerInRoom(game, { id: me.id, displayName: profile.displayName });
   if (!seat.ok) {
      return { ok: false, error: seat.error === 'full' ? 'Ship is full' : 'Failed to board' };
   }

   await db
      .update(roomInvites)
      .set({ status: 'accepted', resolvedAt: new Date() })
      .where(and(eq(roomInvites.id, invite.id), eq(roomInvites.status, 'pending')));

   return { ok: true, code };
}
