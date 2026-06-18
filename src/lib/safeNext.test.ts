import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safeNext';

describe('safeNextPath', () => {
   it('accepts same-origin absolute paths', () => {
      expect(safeNextPath('/profile')).toBe('/profile');
      expect(safeNextPath('/play/ABCD')).toBe('/play/ABCD');
      expect(safeNextPath('/play/ABCD?foo=bar')).toBe('/play/ABCD?foo=bar');
   });

   it('falls back to /profile for protocol-relative values', () => {
      expect(safeNextPath('//evil.com')).toBe('/profile');
      expect(safeNextPath('//evil.com/path')).toBe('/profile');
   });

   it('falls back to /profile for backslash-tricked authority values', () => {
      expect(safeNextPath('/\\evil.com')).toBe('/profile');
      expect(safeNextPath('/\\/evil.com')).toBe('/profile');
   });

   it('falls back to /profile for absolute URLs', () => {
      expect(safeNextPath('https://evil.com')).toBe('/profile');
      expect(safeNextPath('http://evil.com')).toBe('/profile');
      expect(safeNextPath('javascript:alert(1)')).toBe('/profile');
   });

   it('falls back to /profile for relative (non-slash) values', () => {
      expect(safeNextPath('profile')).toBe('/profile');
      expect(safeNextPath('evil.com')).toBe('/profile');
   });

   it('falls back to /profile for missing or empty input', () => {
      expect(safeNextPath(null)).toBe('/profile');
      expect(safeNextPath(undefined)).toBe('/profile');
      expect(safeNextPath('')).toBe('/profile');
   });
});
