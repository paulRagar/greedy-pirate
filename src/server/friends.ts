import 'server-only';

/**
 * Pure helpers for the friend graph. Kept free of DB/IO so the branching that
 * decides what a friend request should do is unit-testable without mocking
 * Drizzle. The server actions in `actions/friendActions.ts` gather the flags
 * from the DB and feed them here.
 */

/**
 * A friendship is stored as ONE canonical row with `user_low < user_high`
 * (enforced by a CHECK). Order any pair the same way so lookups/inserts hit
 * that single row regardless of who initiated.
 */
export function canonicalPair(a: string, b: string): { low: string; high: string } {
   return a < b ? { low: a, high: b } : { low: b, high: a };
}

/** Relationship facts between the sender and the target, read from the DB. */
export type FriendRequestFlags = {
   /** Sender and target are the same account. */
   isSelf: boolean;
   /** Sender is an anonymous (not signed-up) user. */
   senderIsAnonymous: boolean;
   /** A `friendships` edge already exists for the pair. */
   alreadyFriends: boolean;
   /** Sender already has a pending request out to the target. */
   pendingFromSender: boolean;
   /** Target already has a pending request out to the sender. */
   pendingToSender: boolean;
   /** Sender has blocked the target. */
   senderBlockedTarget: boolean;
   /** Target has blocked the sender. */
   targetBlockedSender: boolean;
};

export type FriendRequestDecision =
   | { action: 'reject'; error: string }
   /** Reverse request already pending — accept it instead of creating a new one. */
   | { action: 'accept_reverse' }
   /** Sender already has an open request to the target — idempotent no-op. */
   | { action: 'already_pending' }
   /** Create a fresh pending request. */
   | { action: 'create' };

/**
 * Decide what a `sendFriendRequest(sender → target)` call should do given the
 * current relationship. Order matters: self/anon guards first, then block
 * guards (the target-blocked-sender case returns a deliberately generic error
 * so we don't reveal that the sender was blocked), then state transitions.
 */
export function decideFriendRequest(flags: FriendRequestFlags): FriendRequestDecision {
   if (flags.isSelf) return { action: 'reject', error: 'You cannot friend yourself' };
   if (flags.senderIsAnonymous) {
      return { action: 'reject', error: 'Sign in to add friends' };
   }
   if (flags.senderBlockedTarget) {
      return { action: 'reject', error: 'Unblock this player before adding them' };
   }
   // Do not reveal that the target blocked the sender — generic failure.
   if (flags.targetBlockedSender) {
      return { action: 'reject', error: 'Could not send request' };
   }
   if (flags.alreadyFriends) return { action: 'reject', error: 'Already friends' };
   if (flags.pendingToSender) return { action: 'accept_reverse' };
   if (flags.pendingFromSender) return { action: 'already_pending' };
   return { action: 'create' };
}

/** How a search result relates to the viewer — drives the Add-tab row action. */
export type FriendRelationship = 'self' | 'friend' | 'pending_out' | 'pending_in' | 'none';

/**
 * Classify a candidate relative to the viewer for search results. `pending_out`
 * = the viewer sent them a request; `pending_in` = they sent the viewer one.
 */
export function classifyRelationship(flags: {
   isSelf: boolean;
   isFriend: boolean;
   pendingFromViewer: boolean;
   pendingToViewer: boolean;
}): FriendRelationship {
   if (flags.isSelf) return 'self';
   if (flags.isFriend) return 'friend';
   if (flags.pendingFromViewer) return 'pending_out';
   if (flags.pendingToViewer) return 'pending_in';
   return 'none';
}
