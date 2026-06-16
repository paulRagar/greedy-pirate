import { describe, expect, it } from 'vitest';
import { isDefaultDisplayName } from '@/lib/displayName';

describe('isDefaultDisplayName', () => {
   it('matches the legacy bare default', () => {
      expect(isDefaultDisplayName('Crewmate')).toBe(true);
   });

   it('matches the hash-suffixed default', () => {
      expect(isDefaultDisplayName('Crewmate #0001')).toBe(true);
      expect(isDefaultDisplayName('Crewmate #9999')).toBe(true);
   });

   it('rejects names that merely start with Crewmate', () => {
      expect(isDefaultDisplayName('Crewmate Joe')).toBe(false);
      expect(isDefaultDisplayName('Crewmate #')).toBe(false);
      expect(isDefaultDisplayName('Crewmate1234')).toBe(false);
   });

   it('rejects user-chosen names', () => {
      expect(isDefaultDisplayName('Peter Pan')).toBe(false);
      expect(isDefaultDisplayName('Captain Blackbeard')).toBe(false);
   });

   it('handles null / empty input safely', () => {
      expect(isDefaultDisplayName(null)).toBe(false);
      expect(isDefaultDisplayName(undefined)).toBe(false);
      expect(isDefaultDisplayName('')).toBe(false);
   });
});
