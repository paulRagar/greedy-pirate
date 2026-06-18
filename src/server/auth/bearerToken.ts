import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time check that an Authorization header carries the expected
 * bearer secret.
 *
 * Uses `timingSafeEqual` over fixed-length SHA-256 digests so the comparison
 * is immune to both content- and length-based timing side channels — important
 * because this gates a public, destructive cron endpoint.
 *
 * Fails closed: a missing/empty secret or a missing header always returns
 * false, regardless of the supplied header.
 */
export function isValidBearer(
   header: string | null | undefined,
   secret: string | null | undefined,
): boolean {
   if (!secret) return false;
   if (!header) return false;

   const expected = sha256(`Bearer ${secret}`);
   const provided = sha256(header);
   return timingSafeEqual(expected, provided);
}

function sha256(value: string): Buffer {
   return createHash('sha256').update(value, 'utf8').digest();
}
