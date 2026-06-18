import { describe, expect, it } from 'vitest';
import { maskEmail } from './maskEmail';

describe('maskEmail', () => {
   it('masks all but the first local-part character, keeping the domain', () => {
      expect(maskEmail('alice@example.com')).toBe('a••••@example.com');
   });

   it('masks short local parts', () => {
      expect(maskEmail('bo@example.com')).toBe('b•@example.com');
      expect(maskEmail('x@example.com')).toBe('•@example.com');
   });

   it('returns null for null/empty input', () => {
      expect(maskEmail(null)).toBeNull();
      expect(maskEmail(undefined)).toBeNull();
      expect(maskEmail('')).toBeNull();
   });

   it('does not leak the local part beyond the first character', () => {
      const masked = maskEmail('verylongname@domain.io');
      expect(masked).toBe('v•••••••••••@domain.io');
      expect(masked).not.toContain('erylongname');
   });

   it('returns a generic mask for values without a usable local part', () => {
      expect(maskEmail('not-an-email')).toBe('••••');
      expect(maskEmail('@nolocal.com')).toBe('••••');
   });
});
