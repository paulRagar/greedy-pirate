import { describe, expect, it } from 'vitest';
import { needsSessionRefresh } from './sessionRoutes';

describe('needsSessionRefresh', () => {
   it('refreshes on auth-sensitive routes', () => {
      expect(needsSessionRefresh('/profile')).toBe(true);
      expect(needsSessionRefresh('/profile/')).toBe(true);
      expect(needsSessionRefresh('/play')).toBe(true);
      expect(needsSessionRefresh('/play/new')).toBe(true);
      expect(needsSessionRefresh('/play/join')).toBe(true);
      expect(needsSessionRefresh('/play/lobby')).toBe(true);
      expect(needsSessionRefresh('/play/ABCD')).toBe(true);
      expect(needsSessionRefresh('/admin/rooms')).toBe(true);
      expect(needsSessionRefresh('/auth/callback')).toBe(true);
      expect(needsSessionRefresh('/auth/reset')).toBe(true);
      expect(needsSessionRefresh('/setup')).toBe(true);
   });

   it('skips the refresh on public routes', () => {
      expect(needsSessionRefresh('/')).toBe(false);
      expect(needsSessionRefresh('/rules')).toBe(false);
      expect(needsSessionRefresh('/choose-game')).toBe(false);
   });

   it('does not treat /play-local as an online /play route', () => {
      // /play-local is pure client-side local play — it never reads the user.
      expect(needsSessionRefresh('/play-local')).toBe(false);
   });

   it('does not match on prefix substrings of unrelated paths', () => {
      expect(needsSessionRefresh('/profiles')).toBe(false);
      expect(needsSessionRefresh('/playground')).toBe(false);
      expect(needsSessionRefresh('/setupera')).toBe(false);
      expect(needsSessionRefresh('/authentic')).toBe(false);
   });
});
