import { describe, expect, it } from 'vitest';
import { isValidBearer } from './bearerToken';

const SECRET = 'super-secret-value';

describe('isValidBearer', () => {
   it('authorizes a correct bearer header', () => {
      expect(isValidBearer(`Bearer ${SECRET}`, SECRET)).toBe(true);
   });

   it('rejects a wrong secret', () => {
      expect(isValidBearer('Bearer nope', SECRET)).toBe(false);
   });

   it('rejects a header missing the Bearer scheme', () => {
      expect(isValidBearer(SECRET, SECRET)).toBe(false);
   });

   it('rejects a missing header', () => {
      expect(isValidBearer(null, SECRET)).toBe(false);
      expect(isValidBearer(undefined, SECRET)).toBe(false);
      expect(isValidBearer('', SECRET)).toBe(false);
   });

   it('fails closed when the secret is missing or empty', () => {
      expect(isValidBearer(`Bearer ${SECRET}`, undefined)).toBe(false);
      expect(isValidBearer(`Bearer ${SECRET}`, null)).toBe(false);
      expect(isValidBearer('Bearer ', '')).toBe(false);
   });

   it('rejects a header of a different length', () => {
      expect(isValidBearer(`Bearer ${SECRET}-extra`, SECRET)).toBe(false);
   });
});
