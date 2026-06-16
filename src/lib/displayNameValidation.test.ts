import { describe, expect, it } from 'vitest';
import { normalizeDisplayName, validateDisplayName } from './displayNameValidation';

describe('normalizeDisplayName', () => {
   it('trims surrounding whitespace', () => {
      expect(normalizeDisplayName('   Peter Pan   ')).toBe('Peter Pan');
   });

   it('collapses internal whitespace runs', () => {
      expect(normalizeDisplayName('Peter    Pan')).toBe('Peter Pan');
      expect(normalizeDisplayName('Peter\tPan')).toBe('Peter Pan');
   });

   it('strips zero-width and bidi characters', () => {
      // ZWSP ​ inside, RLM ‏ at the end
      const sneaky = 'Peter​‏Pan';
      expect(normalizeDisplayName(sneaky)).toBe('PeterPan');
   });

   it('strips C0 control characters', () => {
      expect(normalizeDisplayName('Peter')).toBe('Peter');
   });
});

describe('validateDisplayName', () => {
   it('accepts a typical pirate-flavored name', () => {
      expect(validateDisplayName('Peter Pan')).toEqual({ ok: true, name: 'Peter Pan' });
   });

   it("allows the small punctuation we explicitly permit (- _ . ')", () => {
      expect(validateDisplayName("O'Malley")).toEqual({ ok: true, name: "O'Malley" });
      expect(validateDisplayName('Black-Beard')).toEqual({ ok: true, name: 'Black-Beard' });
      expect(validateDisplayName('crew_mate')).toEqual({ ok: true, name: 'crew_mate' });
      expect(validateDisplayName('Mr. Smee')).toEqual({ ok: true, name: 'Mr. Smee' });
   });

   it('rejects names below the minimum length', () => {
      const res = validateDisplayName('A');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/at least 2/i);
   });

   it('rejects names over the maximum length', () => {
      const res = validateDisplayName('a'.repeat(21));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/20 characters or fewer/i);
   });

   it('rejects names with disallowed punctuation', () => {
      expect(validateDisplayName('Hi@there').ok).toBe(false);
      expect(validateDisplayName('Hi!').ok).toBe(false);
      expect(validateDisplayName('emoji 🏴‍☠️').ok).toBe(false);
   });

   it('treats whitespace-only and empty input as too short', () => {
      expect(validateDisplayName('').ok).toBe(false);
      expect(validateDisplayName('   ').ok).toBe(false);
   });

   it('treats zero-width-only input as too short', () => {
      expect(validateDisplayName('​​').ok).toBe(false);
   });
});
