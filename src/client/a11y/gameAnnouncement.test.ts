import { describe, expect, it } from 'vitest';
import { deriveAnnouncement, type AnnounceSnapshot } from './gameAnnouncement';

const base: AnnounceSnapshot = {
   status: 'active',
   turnIndex: 0,
   currentCardKind: null,
   currentName: 'Anne',
   winnerName: null,
   isMyTurn: false,
};

describe('deriveAnnouncement', () => {
   it('announces whose turn it is on the first active snapshot', () => {
      expect(deriveAnnouncement(null, { ...base, isMyTurn: true })).toEqual({
         message: 'Your turn.',
         assertive: false,
      });
   });

   it('names the next player on a turn change', () => {
      const prev = { ...base, turnIndex: 0, currentName: 'Anne' };
      const next = { ...base, turnIndex: 1, currentName: 'Bart' };
      expect(deriveAnnouncement(prev, next)).toEqual({
         message: 'Bart is at the helm.',
         assertive: false,
      });
   });

   it('announces bust assertively when a pirate is revealed', () => {
      const prev = { ...base, currentCardKind: 'gold' as const };
      const next = { ...base, currentCardKind: 'pirate' as const };
      expect(deriveAnnouncement(prev, next)).toEqual({
         message: 'Pirate! Streak lost.',
         assertive: true,
      });
   });

   it('announces game over with the winner assertively', () => {
      const prev = { ...base, status: 'active' as const };
      const next = { ...base, status: 'complete' as const, winnerName: 'Anne' };
      expect(deriveAnnouncement(prev, next)).toEqual({
         message: 'Deck empty. Anne wins.',
         assertive: true,
      });
   });

   it('does not re-announce a steady state', () => {
      const snap = { ...base, currentCardKind: 'gold' as const };
      expect(deriveAnnouncement(snap, snap)).toBeNull();
   });

   it('does not re-announce a pirate that was already revealed', () => {
      const prev = { ...base, currentCardKind: 'pirate' as const };
      const next = { ...base, currentCardKind: 'pirate' as const };
      expect(deriveAnnouncement(prev, next)).toBeNull();
   });
});
