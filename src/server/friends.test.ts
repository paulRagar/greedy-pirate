import { describe, expect, it } from 'vitest';
import {
   canonicalPair,
   classifyRelationship,
   decideFriendRequest,
   type FriendRequestFlags,
} from './friends';

const NONE: FriendRequestFlags = {
   isSelf: false,
   senderIsAnonymous: false,
   alreadyFriends: false,
   pendingFromSender: false,
   pendingToSender: false,
   senderBlockedTarget: false,
   targetBlockedSender: false,
};

describe('canonicalPair', () => {
   it('orders a pair the same way regardless of argument order', () => {
      const a = '11111111-1111-1111-1111-111111111111';
      const b = '22222222-2222-2222-2222-222222222222';
      expect(canonicalPair(a, b)).toEqual({ low: a, high: b });
      expect(canonicalPair(b, a)).toEqual({ low: a, high: b });
   });
});

describe('decideFriendRequest', () => {
   it('creates a request when there is no prior relationship', () => {
      expect(decideFriendRequest(NONE)).toEqual({ action: 'create' });
   });

   it('rejects friending yourself', () => {
      const d = decideFriendRequest({ ...NONE, isSelf: true });
      expect(d).toEqual({ action: 'reject', error: 'You cannot friend yourself' });
   });

   it('rejects an anonymous sender (sign-in gate)', () => {
      const d = decideFriendRequest({ ...NONE, senderIsAnonymous: true });
      expect(d).toMatchObject({ action: 'reject' });
      expect(d).toEqual({ action: 'reject', error: 'Sign in to add friends' });
   });

   it('rejects when the sender has blocked the target (asks to unblock)', () => {
      const d = decideFriendRequest({ ...NONE, senderBlockedTarget: true });
      expect(d).toEqual({ action: 'reject', error: 'Unblock this player before adding them' });
   });

   it('rejects with a GENERIC error when the target blocked the sender (no leak)', () => {
      const d = decideFriendRequest({ ...NONE, targetBlockedSender: true });
      expect(d).toEqual({ action: 'reject', error: 'Could not send request' });
   });

   it('rejects when already friends', () => {
      const d = decideFriendRequest({ ...NONE, alreadyFriends: true });
      expect(d).toEqual({ action: 'reject', error: 'Already friends' });
   });

   it('auto-accepts the reverse request when the target already asked', () => {
      expect(decideFriendRequest({ ...NONE, pendingToSender: true })).toEqual({
         action: 'accept_reverse',
      });
   });

   it('is idempotent when the sender already has a pending request out', () => {
      expect(decideFriendRequest({ ...NONE, pendingFromSender: true })).toEqual({
         action: 'already_pending',
      });
   });

   it('prioritises block guards over already-friends / pending state', () => {
      // A block must win even if other flags are set, so a blocked user can't
      // ride an existing pending row.
      const d = decideFriendRequest({
         ...NONE,
         targetBlockedSender: true,
         pendingToSender: true,
         alreadyFriends: true,
      });
      expect(d).toEqual({ action: 'reject', error: 'Could not send request' });
   });

   it('prioritises reverse-pending over the sender own pending (auto-accept wins)', () => {
      const d = decideFriendRequest({
         ...NONE,
         pendingToSender: true,
         pendingFromSender: true,
      });
      expect(d).toEqual({ action: 'accept_reverse' });
   });
});

describe('classifyRelationship', () => {
   const REL = {
      isSelf: false,
      isFriend: false,
      pendingFromViewer: false,
      pendingToViewer: false,
   };

   it('returns none with no relationship', () => {
      expect(classifyRelationship(REL)).toBe('none');
   });

   it('returns self for the viewer', () => {
      expect(classifyRelationship({ ...REL, isSelf: true })).toBe('self');
   });

   it('returns friend when already friends', () => {
      expect(classifyRelationship({ ...REL, isFriend: true })).toBe('friend');
   });

   it('distinguishes outgoing vs incoming pending', () => {
      expect(classifyRelationship({ ...REL, pendingFromViewer: true })).toBe('pending_out');
      expect(classifyRelationship({ ...REL, pendingToViewer: true })).toBe('pending_in');
   });

   it('self outranks every other flag', () => {
      expect(
         classifyRelationship({ isSelf: true, isFriend: true, pendingFromViewer: true, pendingToViewer: true }),
      ).toBe('self');
   });
});
