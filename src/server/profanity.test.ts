import { describe, expect, it } from 'vitest';
import { containsProfanity } from './profanity';

/**
 * Sanity coverage — we don't enumerate the full obscenity dictionary,
 * we just confirm the wrapper says yes to obvious cases and no to
 * innocent pirate-flavored names. Token-level coverage belongs to the
 * `obscenity` package itself.
 */
describe('containsProfanity', () => {
   it('flags an obvious slur', () => {
      expect(containsProfanity('shit')).toBe(true);
   });

   it('catches leetspeak substitutions', () => {
      expect(containsProfanity('sh1t')).toBe(true);
   });

   it('passes ordinary pirate-flavored names', () => {
      expect(containsProfanity('Peter Pan')).toBe(false);
      expect(containsProfanity('Captain Blackbeard')).toBe(false);
      expect(containsProfanity('Crewmate #1234')).toBe(false);
   });

   it('passes the empty string', () => {
      expect(containsProfanity('')).toBe(false);
   });
});
