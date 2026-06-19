'use server';

import 'server-only';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { parseRows } from '@/server/db/parseRows';
import { friendRequests, friendships, userBlocks, users } from '@/server/db/schema';
import {
   canonicalPair,
   classifyRelationship,
   decideFriendRequest,
   type FriendRelationship,
   type FriendRequestFlags,
} from '@/server/friends';
import {
   broadcastFriendRequest,
   broadcastFriendResolved,
} from '@/server/realtime/broadcast';
import { getSupabaseServer } from '@/server/supabase/server';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

/** Minimal, PII-safe shape for a person in a friends list or request. Never email. */
export type FriendSummary = {
   userId: string;
   displayName: string;
   friendCode: string;
};

export type PendingRequest = FriendSummary & {
   requestId: string;
   createdAt: string;
};

export type SendFriendRequestResult =
   | { ok: true; status: 'pending'; requestId: string }
   | { ok: true; status: 'friends' }
   | { ok: false; error: string };

export type FriendActionResult = { ok: true } | { ok: false; error: string };

type AuthedUser = { id: string };

async function requireUser(): Promise<AuthedUser | null> {
   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   return user ? { id: user.id } : null;
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

const SendSchema = z.object({ toUserId: z.string().uuid() });

export async function sendFriendRequest(
   input: z.input<typeof SendSchema>,
): Promise<SendFriendRequestResult> {
   const parsed = SendSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };
   const { toUserId } = parsed.data;

   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };

   const sender = await db.query.users.findFirst({ where: eq(users.id, me.id) });
   if (!sender) return { ok: false, error: 'Profile missing' };

   const target = await db.query.users.findFirst({ where: eq(users.id, toUserId) });
   if (!target) return { ok: false, error: 'Player not found' };

   const pair = canonicalPair(me.id, toUserId);
   const [existingFriendship, pendingFromSender, pendingToSender, blockState] = await Promise.all([
      db.query.friendships.findFirst({
         where: and(eq(friendships.userLow, pair.low), eq(friendships.userHigh, pair.high)),
      }),
      db.query.friendRequests.findFirst({
         where: and(
            eq(friendRequests.fromUserId, me.id),
            eq(friendRequests.toUserId, toUserId),
            eq(friendRequests.status, 'pending'),
         ),
      }),
      db.query.friendRequests.findFirst({
         where: and(
            eq(friendRequests.fromUserId, toUserId),
            eq(friendRequests.toUserId, me.id),
            eq(friendRequests.status, 'pending'),
         ),
      }),
      getBlockState(me.id, toUserId),
   ]);

   const flags: FriendRequestFlags = {
      isSelf: me.id === toUserId,
      senderIsAnonymous: sender.isAnonymous,
      alreadyFriends: Boolean(existingFriendship),
      pendingFromSender: Boolean(pendingFromSender),
      pendingToSender: Boolean(pendingToSender),
      senderBlockedTarget: blockState.viewerBlockedOther,
      targetBlockedSender: blockState.otherBlockedViewer,
   };
   const decision = decideFriendRequest(flags);

   if (decision.action === 'reject') return { ok: false, error: decision.error };

   if (decision.action === 'already_pending') {
      return { ok: true, status: 'pending', requestId: pendingFromSender!.id };
   }

   if (decision.action === 'accept_reverse') {
      // The target already asked us — accepting their request makes us friends.
      await acceptRequest(pendingToSender!.id, me.id, toUserId);
      return { ok: true, status: 'friends' };
   }

   // decision.action === 'create' — rate-limit then insert.
   const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
   const recent = parseRows(
      await db.execute(
         sql`select count(*)::int as count from public.friend_requests where from_user_id = ${me.id} and created_at > ${since.toISOString()}`,
      ),
      z.object({ count: z.number() }),
   );
   if ((recent[0]?.count ?? 0) >= RATE_LIMIT_MAX) {
      return { ok: false, error: 'Easy, sailor — too many requests. Wait a minute.' };
   }

   let requestId: string;
   try {
      const rows = await db
         .insert(friendRequests)
         .values({ fromUserId: me.id, toUserId })
         .returning({ id: friendRequests.id });
      requestId = rows[0]!.id;
   } catch (err) {
      // Concurrent duplicate → the partial unique index fired; treat as pending.
      if (isUniqueViolation(err)) {
         const existing = await db.query.friendRequests.findFirst({
            where: and(
               eq(friendRequests.fromUserId, me.id),
               eq(friendRequests.toUserId, toUserId),
               eq(friendRequests.status, 'pending'),
            ),
         });
         if (existing) return { ok: true, status: 'pending', requestId: existing.id };
      }
      console.error('sendFriendRequest insert failed', err);
      return { ok: false, error: 'Failed to send request' };
   }

   await broadcastFriendRequest(toUserId, {
      requestId,
      fromUserId: me.id,
      fromDisplayName: sender.displayName,
   });

   return { ok: true, status: 'pending', requestId };
}

// ---------------------------------------------------------------------------
// Respond (accept / decline)
// ---------------------------------------------------------------------------

const RespondSchema = z.object({
   requestId: z.string().uuid(),
   accept: z.boolean(),
});

export async function respondToFriendRequest(
   input: z.input<typeof RespondSchema>,
): Promise<FriendActionResult> {
   const parsed = RespondSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };

   const request = await db.query.friendRequests.findFirst({
      where: eq(friendRequests.id, parsed.data.requestId),
   });
   if (!request) return { ok: false, error: 'Request not found' };
   if (request.toUserId !== me.id) return { ok: false, error: 'Not your request' };
   if (request.status !== 'pending') return { ok: true }; // idempotent

   if (parsed.data.accept) {
      await acceptRequest(request.id, request.fromUserId, request.toUserId);
   } else {
      await db
         .update(friendRequests)
         .set({ status: 'declined', resolvedAt: new Date() })
         .where(and(eq(friendRequests.id, request.id), eq(friendRequests.status, 'pending')));
      await broadcastFriendResolved(request.fromUserId, {
         requestId: request.id,
         byUserId: me.id,
         outcome: 'declined',
      });
   }
   return { ok: true };
}

/**
 * Mark a pending request accepted and create the canonical friendship edge in
 * one transaction, then notify the original sender. Idempotent on the edge.
 */
async function acceptRequest(requestId: string, fromUserId: string, toUserId: string): Promise<void> {
   const pair = canonicalPair(fromUserId, toUserId);
   await db.transaction(async (tx) => {
      await tx
         .update(friendRequests)
         .set({ status: 'accepted', resolvedAt: new Date() })
         .where(and(eq(friendRequests.id, requestId), eq(friendRequests.status, 'pending')));
      await tx
         .insert(friendships)
         .values({ userLow: pair.low, userHigh: pair.high })
         .onConflictDoNothing();
   });
   await broadcastFriendResolved(fromUserId, {
      requestId,
      byUserId: toUserId,
      outcome: 'accepted',
   });
}

// ---------------------------------------------------------------------------
// Cancel (sender rescinds) / Remove (drop an accepted friendship)
// ---------------------------------------------------------------------------

const CancelSchema = z.object({ requestId: z.string().uuid() });

export async function cancelFriendRequest(
   input: z.input<typeof CancelSchema>,
): Promise<FriendActionResult> {
   const parsed = CancelSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };

   const request = await db.query.friendRequests.findFirst({
      where: eq(friendRequests.id, parsed.data.requestId),
   });
   if (!request) return { ok: false, error: 'Request not found' };
   if (request.fromUserId !== me.id) return { ok: false, error: 'Not your request' };
   if (request.status !== 'pending') return { ok: true };

   await db
      .update(friendRequests)
      .set({ status: 'cancelled', resolvedAt: new Date() })
      .where(and(eq(friendRequests.id, request.id), eq(friendRequests.status, 'pending')));
   return { ok: true };
}

const RemoveSchema = z.object({ friendId: z.string().uuid() });

export async function removeFriend(
   input: z.input<typeof RemoveSchema>,
): Promise<FriendActionResult> {
   const parsed = RemoveSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };

   const pair = canonicalPair(me.id, parsed.data.friendId);
   await db
      .delete(friendships)
      .where(and(eq(friendships.userLow, pair.low), eq(friendships.userHigh, pair.high)));
   return { ok: true };
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export type ListFriendsResult =
   | { ok: true; friends: FriendSummary[] }
   | { ok: false; error: string };

export async function listFriends(): Promise<ListFriendsResult> {
   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };

   const edges = await db.query.friendships.findMany({
      where: or(eq(friendships.userLow, me.id), eq(friendships.userHigh, me.id)),
   });
   const otherIds = edges.map((e) => (e.userLow === me.id ? e.userHigh : e.userLow));
   if (otherIds.length === 0) return { ok: true, friends: [] };

   const rows = await db.query.users.findMany({ where: inArray(users.id, otherIds) });
   // friend_code is NOT NULL in the DB (backfilled in the friends-graph
   // migration); the Drizzle type lags because the column was added nullable.
   const friends = rows
      .map((u) => ({ userId: u.id, displayName: u.displayName, friendCode: u.friendCode! }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
   return { ok: true, friends };
}

export type ListRequestsResult =
   | { ok: true; requests: PendingRequest[] }
   | { ok: false; error: string };

export async function listIncomingRequests(): Promise<ListRequestsResult> {
   return listPendingRequests('incoming');
}

export async function listOutgoingRequests(): Promise<ListRequestsResult> {
   return listPendingRequests('outgoing');
}

async function listPendingRequests(direction: 'incoming' | 'outgoing'): Promise<ListRequestsResult> {
   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };

   const mineCol = direction === 'incoming' ? friendRequests.toUserId : friendRequests.fromUserId;
   const otherCol = direction === 'incoming' ? friendRequests.fromUserId : friendRequests.toUserId;

   const rows = await db
      .select({
         requestId: friendRequests.id,
         createdAt: friendRequests.createdAt,
         userId: otherCol,
         displayName: users.displayName,
         friendCode: users.friendCode,
      })
      .from(friendRequests)
      .innerJoin(users, eq(users.id, otherCol))
      .where(and(eq(mineCol, me.id), eq(friendRequests.status, 'pending')))
      .orderBy(desc(friendRequests.createdAt));

   return {
      ok: true,
      requests: rows.map((r) => ({
         requestId: r.requestId,
         userId: r.userId,
         displayName: r.displayName,
         friendCode: r.friendCode!, // NOT NULL in DB; Drizzle type lags (see listFriends).
         createdAt: r.createdAt.toISOString(),
      })),
   };
}

// ---------------------------------------------------------------------------
// Block / unblock + the shared block guard
// ---------------------------------------------------------------------------

/**
 * Directional block state between a viewer and another user. The shared guard
 * for every "can these two interact?" check — friend requests today, room
 * invites / join requests later (GRE-45/46).
 */
export async function getBlockState(
   viewerId: string,
   otherId: string,
): Promise<{ viewerBlockedOther: boolean; otherBlockedViewer: boolean }> {
   const rows = await db.query.userBlocks.findMany({
      where: or(
         and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, otherId)),
         and(eq(userBlocks.blockerId, otherId), eq(userBlocks.blockedId, viewerId)),
      ),
   });
   return {
      viewerBlockedOther: rows.some((r) => r.blockerId === viewerId),
      otherBlockedViewer: rows.some((r) => r.blockerId === otherId),
   };
}

/** Either-direction block — convenience for callers that don't need the direction. */
export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
   const s = await getBlockState(a, b);
   return s.viewerBlockedOther || s.otherBlockedViewer;
}

const BlockSchema = z.object({ userId: z.string().uuid() });

export async function blockUser(
   input: z.input<typeof BlockSchema>,
): Promise<FriendActionResult> {
   const parsed = BlockSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };
   const { userId } = parsed.data;

   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };
   if (userId === me.id) return { ok: false, error: 'You cannot block yourself' };

   const pair = canonicalPair(me.id, userId);
   // One transaction: record the block, sever any friendship, and cancel every
   // pending request in either direction so nothing dangles after the block.
   await db.transaction(async (tx) => {
      await tx
         .insert(userBlocks)
         .values({ blockerId: me.id, blockedId: userId })
         .onConflictDoNothing();
      await tx
         .delete(friendships)
         .where(and(eq(friendships.userLow, pair.low), eq(friendships.userHigh, pair.high)));
      await tx
         .update(friendRequests)
         .set({ status: 'cancelled', resolvedAt: new Date() })
         .where(
            and(
               eq(friendRequests.status, 'pending'),
               or(
                  and(eq(friendRequests.fromUserId, me.id), eq(friendRequests.toUserId, userId)),
                  and(eq(friendRequests.fromUserId, userId), eq(friendRequests.toUserId, me.id)),
               ),
            ),
         );
   });
   return { ok: true };
}

const UnblockSchema = z.object({ userId: z.string().uuid() });

export async function unblockUser(
   input: z.input<typeof UnblockSchema>,
): Promise<FriendActionResult> {
   const parsed = UnblockSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };

   await db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, me.id), eq(userBlocks.blockedId, parsed.data.userId)));
   return { ok: true };
}

export type BlockedUser = { userId: string; displayName: string };

export type ListBlockedResult =
   | { ok: true; blocked: BlockedUser[] }
   | { ok: false; error: string };

/** People the viewer has blocked. Display name only — never email (org PII rule). */
export async function listBlocked(): Promise<ListBlockedResult> {
   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };

   const rows = await db
      .select({ userId: users.id, displayName: users.displayName })
      .from(userBlocks)
      .innerJoin(users, eq(users.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, me.id))
      .orderBy(desc(userBlocks.createdAt));

   return { ok: true, blocked: rows };
}

// ---------------------------------------------------------------------------
// Search + own friend code
// ---------------------------------------------------------------------------

const SEARCH_RATE_WINDOW_MS = 60_000;
const SEARCH_RATE_MAX = 30;
const SEARCH_RESULT_LIMIT = 10;

// Best-effort, per-instance sliding-window limiter. Search is read-only so
// there's no row to count; this caps abusive polling without external infra
// (Fluid Compute reuses instances, so it bites in practice). The real
// enumeration defense is exact-match + no email in results, not this.
const searchHits = new Map<string, number[]>();

function searchRateOk(userId: string, now: number): boolean {
   const recent = (searchHits.get(userId) ?? []).filter((t) => now - t < SEARCH_RATE_WINDOW_MS);
   recent.push(now);
   searchHits.set(userId, recent);
   return recent.length <= SEARCH_RATE_MAX;
}

export type UserSearchResult = {
   userId: string;
   displayName: string;
   friendCode: string;
   relationship: FriendRelationship;
};

export type SearchUsersResult =
   | { ok: true; results: UserSearchResult[] }
   | { ok: false; error: string };

const SearchSchema = z.object({ query: z.string().trim().min(1).max(40) });

/**
 * Find people to friend by **exact** friend code OR **exact** display name
 * (both case-insensitive). No fuzzy/partial matching and email is never a key
 * nor returned — this is the PII-safe, enumeration-resistant model (GRE-38).
 * Results exclude anyone with a block in either direction and carry the
 * viewer's relationship so the Add tab can render the right row action.
 */
export async function searchUsers(
   input: z.input<typeof SearchSchema>,
): Promise<SearchUsersResult> {
   const parsed = SearchSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };
   const q = parsed.data.query;

   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };

   if (!searchRateOk(me.id, Date.now())) {
      return { ok: false, error: 'Slow down — too many searches. Wait a minute.' };
   }

   // Exact match on code (stored uppercase) or display name, case-insensitive.
   const candidates = await db
      .select({
         userId: users.id,
         displayName: users.displayName,
         friendCode: users.friendCode,
      })
      .from(users)
      .where(
         or(
            sql`upper(${users.friendCode}) = upper(${q})`,
            sql`lower(${users.displayName}) = lower(${q})`,
         ),
      )
      .limit(SEARCH_RESULT_LIMIT);

   if (candidates.length === 0) return { ok: true, results: [] };

   const ids = candidates.map((c) => c.userId);
   const [blocks, friendEdges, pendingFromMe, pendingToMe] = await Promise.all([
      db.query.userBlocks.findMany({
         where: or(
            and(eq(userBlocks.blockerId, me.id), inArray(userBlocks.blockedId, ids)),
            and(eq(userBlocks.blockedId, me.id), inArray(userBlocks.blockerId, ids)),
         ),
      }),
      db.query.friendships.findMany({
         where: or(
            and(eq(friendships.userLow, me.id), inArray(friendships.userHigh, ids)),
            and(eq(friendships.userHigh, me.id), inArray(friendships.userLow, ids)),
         ),
      }),
      db.query.friendRequests.findMany({
         where: and(
            eq(friendRequests.fromUserId, me.id),
            inArray(friendRequests.toUserId, ids),
            eq(friendRequests.status, 'pending'),
         ),
      }),
      db.query.friendRequests.findMany({
         where: and(
            eq(friendRequests.toUserId, me.id),
            inArray(friendRequests.fromUserId, ids),
            eq(friendRequests.status, 'pending'),
         ),
      }),
   ]);

   // Any block in either direction hides the user entirely.
   const blockedIds = new Set<string>();
   for (const b of blocks) {
      blockedIds.add(b.blockerId === me.id ? b.blockedId : b.blockerId);
   }
   const friendIds = new Set(
      friendEdges.map((e) => (e.userLow === me.id ? e.userHigh : e.userLow)),
   );
   const pendingOut = new Set(pendingFromMe.map((r) => r.toUserId));
   const pendingIn = new Set(pendingToMe.map((r) => r.fromUserId));

   const results: UserSearchResult[] = candidates
      .filter((c) => !blockedIds.has(c.userId))
      .map((c) => ({
         userId: c.userId,
         displayName: c.displayName,
         friendCode: c.friendCode!, // NOT NULL in DB; Drizzle type lags.
         relationship: classifyRelationship({
            isSelf: c.userId === me.id,
            isFriend: friendIds.has(c.userId),
            pendingFromViewer: pendingOut.has(c.userId),
            pendingToViewer: pendingIn.has(c.userId),
         }),
      }));

   return { ok: true, results };
}

export type MyFriendCodeResult =
   | { ok: true; friendCode: string }
   | { ok: false; error: string };

/** The signed-in user's own shareable friend code (for display + share link). */
export async function getMyFriendCode(): Promise<MyFriendCodeResult> {
   const me = await requireUser();
   if (!me) return { ok: false, error: 'Not signed in' };
   const profile = await db.query.users.findFirst({ where: eq(users.id, me.id) });
   if (!profile?.friendCode) return { ok: false, error: 'No code yet' };
   return { ok: true, friendCode: profile.friendCode };
}

// ---------------------------------------------------------------------------

function isUniqueViolation(err: unknown): boolean {
   return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: unknown }).code === '23505'
   );
}
