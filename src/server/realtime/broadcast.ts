import 'server-only';
import { revalidatePath } from 'next/cache';
import type { PublicGameState } from '@/game/public';

const TOPIC_PREFIX = 'room';
const LOBBY_TOPIC = 'lobby:public';
const BROADCAST_EVENT = 'state';
const KNOCK_REQUESTED_EVENT = 'knock:requested';
const KNOCK_CANCELLED_EVENT = 'knock:cancelled';
const KNOCK_RESOLVED_EVENT = 'knock:resolved';
const FRIEND_REQUESTED_EVENT = 'friend:requested';
const FRIEND_RESOLVED_EVENT = 'friend:resolved';
const ROOM_INVITE_EVENT = 'room:invite';

export function roomTopic(code: string): string {
   return `${TOPIC_PREFIX}:${code.toUpperCase()}`;
}

/**
 * Per-user topic used to deliver a join-request verdict to a knocker who is
 * not yet a room member (so they can't subscribe to `room:{CODE}`). Gated by
 * RLS to the user whose id matches the suffix.
 */
export function userKnockTopic(userId: string): string {
   return `knock:${userId}`;
}

/**
 * Generic per-user topic used to deliver friend requests, room invites, and
 * other notices to a user who is not currently in a room (so they can't be
 * reached on `room:{CODE}`). Gated by RLS (`realtime.is_own_user_topic`) to the
 * user whose id matches the suffix. Generalises {@link userKnockTopic}.
 */
export function userTopic(userId: string): string {
   return `user:${userId}`;
}

export const ROOM_BROADCAST_EVENT = BROADCAST_EVENT;
export const LOBBY_BROADCAST_TOPIC = LOBBY_TOPIC;
export const ROOM_KNOCK_REQUESTED_EVENT = KNOCK_REQUESTED_EVENT;
export const ROOM_KNOCK_CANCELLED_EVENT = KNOCK_CANCELLED_EVENT;
export const ROOM_KNOCK_RESOLVED_EVENT = KNOCK_RESOLVED_EVENT;
export const USER_FRIEND_REQUESTED_EVENT = FRIEND_REQUESTED_EVENT;
export const USER_FRIEND_RESOLVED_EVENT = FRIEND_RESOLVED_EVENT;
export const USER_ROOM_INVITE_EVENT = ROOM_INVITE_EVENT;

export type RoomSpectator = {
   readonly id: string;
   readonly name: string;
};

export type ContinuationState = {
   deadlineAt: string;
   continuedIds: ReadonlyArray<string>;
   seatedIds: ReadonlyArray<string>;
} | null;

type StatePayload = {
   state: PublicGameState;
   spectators: ReadonlyArray<RoomSpectator>;
   actorId: string | null;
   eventType: string;
   /**
    * Monotonic version of this state — the `game_events.seq` of the step that
    * produced it. Lets clients drop out-of-order / late broadcasts. Omitted by
    * auxiliary broadcasts that re-publish current state without advancing the
    * game (spectator join/leave, knock resolution, host change).
    */
   version?: number;
   continuation?: ContinuationState;
   hostId?: string;
   /**
    * Achievements unlocked for the first time by the completion of this game,
    * keyed by user id. Only set on the completing broadcast. Members read their
    * own entry to toast personally; the key set marks who to badge on the
    * scoreboard. Achievement codes are not sensitive.
    */
   unlocks?: Record<string, string[]>;
};

export type KnockRequestedPayload = {
   requestId: string;
   requesterId: string;
   displayName: string;
   kind: 'player' | 'spectator';
   expiresAt: string;
};

export type KnockCancelledPayload = {
   requestId: string;
   requesterId: string;
};

export type KnockResolvedPayload = {
   requestId: string;
   requesterId: string;
   outcome: 'approved' | 'denied' | 'expired' | 'cancelled';
};

export type LobbyRoomSummary = {
   code: string;
   hostDisplayName: string;
   playerCount: number;
   maxPlayers: number;
   status: 'lobby' | 'active';
   deckVariant: string;
   createdAt: string;
};

export type LobbyEvent =
   | { type: 'room_created'; room: LobbyRoomSummary }
   | { type: 'room_updated'; code: string; playerCount: number; status: 'lobby' | 'active' }
   | { type: 'room_removed'; code: string };

async function postBroadcast(
   topic: string,
   event: string,
   payload: unknown,
   isPrivate = true,
): Promise<void> {
   const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
   const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
   if (!url || !key) {
      console.error('[broadcast] Missing Supabase env vars');
      return;
   }

   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), 3000);
   try {
      const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            apikey: key,
            Authorization: `Bearer ${key}`,
         },
         body: JSON.stringify({
            messages: [
               {
                  topic,
                  event,
                  payload,
                  private: isPrivate,
               },
            ],
         }),
         signal: controller.signal,
      });
      if (!response.ok) {
         const body = await response.text();
         console.error(`[broadcast] failed ${topic}/${event} (${response.status}): ${body}`);
      }
   } catch (err) {
      console.error(`[broadcast] threw on ${topic}/${event}`, err);
   } finally {
      clearTimeout(timer);
   }
}

export async function broadcastRoomState(
   code: string,
   payload: StatePayload,
): Promise<void> {
   await postBroadcast(roomTopic(code), BROADCAST_EVENT, payload);
}

export async function broadcastKnockRequested(
   code: string,
   payload: KnockRequestedPayload,
): Promise<void> {
   await postBroadcast(roomTopic(code), KNOCK_REQUESTED_EVENT, payload);
}

export async function broadcastKnockCancelled(
   code: string,
   payload: KnockCancelledPayload,
): Promise<void> {
   await postBroadcast(roomTopic(code), KNOCK_CANCELLED_EVENT, payload);
}

export async function broadcastKnockResolved(
   payload: KnockResolvedPayload,
): Promise<void> {
   // Delivered on the requester's own private topic — they are not yet a room
   // member and so cannot subscribe to `room:{CODE}`.
   await postBroadcast(userKnockTopic(payload.requesterId), KNOCK_RESOLVED_EVENT, payload);
}

// ---------------------------------------------------------------------------
// Per-user notices (friends & social). Delivered on the recipient's private
// `user:{id}` topic. Payload shapes only — the consuming UI/actions land in the
// friend-lifecycle, inbox, and invite issues.
// ---------------------------------------------------------------------------

export type FriendRequestedPayload = {
   requestId: string;
   fromUserId: string;
   fromDisplayName: string;
};

export type FriendResolvedPayload = {
   requestId: string;
   /** The user who acted on the request (the original recipient). */
   byUserId: string;
   outcome: 'accepted' | 'declined';
};

export type RoomInvitePayload = {
   code: string;
   fromUserId: string;
   fromDisplayName: string;
   isPublic: boolean;
};

/** Notify a user that someone sent them a friend request. */
export async function broadcastFriendRequest(
   toUserId: string,
   payload: FriendRequestedPayload,
): Promise<void> {
   await postBroadcast(userTopic(toUserId), FRIEND_REQUESTED_EVENT, payload);
}

/** Notify the original sender that their friend request was accepted/declined. */
export async function broadcastFriendResolved(
   toUserId: string,
   payload: FriendResolvedPayload,
): Promise<void> {
   await postBroadcast(userTopic(toUserId), FRIEND_RESOLVED_EVENT, payload);
}

/** Notify a friend that they've been invited to a room. */
export async function broadcastRoomInvite(
   toUserId: string,
   payload: RoomInvitePayload,
): Promise<void> {
   await postBroadcast(userTopic(toUserId), ROOM_INVITE_EVENT, payload);
}

export async function broadcastLobbyEvent(event: LobbyEvent): Promise<void> {
   // Invalidate the cached /play/lobby RSC payload so the next visitor sees
   // fresh counts/status. Realtime broadcasts handle live viewers; this
   // covers the "navigated away then back" case.
   revalidatePath('/play/lobby');
   // The lobby is a public matchmaking list — published on a public channel so
   // anyone browsing can see it without being a member of any room.
   await postBroadcast(LOBBY_TOPIC, event.type, event, false);
}
