/**
 * Pure validator for incoming display name strings. Shared by the
 * server action (where the actual auth + DB writes live) and by tests
 * that want to assert validation without spinning up Supabase.
 *
 * The profanity check is intentionally out of scope here — it lives
 * in a server-only module (its dictionary doesn't belong on the
 * client bundle). Callers chain the two: validate → profanity.
 */

import { z } from 'zod';

export const MIN_DISPLAY_NAME_LEN = 2;
export const MAX_DISPLAY_NAME_LEN = 20;
const ALLOWED = /^[\p{L}\p{N} _.'\-]+$/u;

// Control chars (except tab / LF / VT / FF / CR which behave as
// whitespace and are normalized to plain spaces by the \s+ collapse),
// DEL, C1 controls, zero-width chars, bidi marks, line/paragraph
// separators, word joiner, BOM. Built from a string so this source
// file stays free of literal invisible characters.
const STRIP_CHARS = new RegExp(
   '[\\u0000-\\u0008\\u000E-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u2028-\\u202F\\u2060-\\u206F\\uFEFF]',
   'g',
);

export function normalizeDisplayName(input: string): string {
   return input.replace(STRIP_CHARS, '').trim().replace(/\s+/g, ' ');
}

export const DisplayNameSchema = z
   .string()
   .transform(normalizeDisplayName)
   .pipe(
      z
         .string()
         .min(MIN_DISPLAY_NAME_LEN, `Name must be at least ${MIN_DISPLAY_NAME_LEN} characters`)
         .max(MAX_DISPLAY_NAME_LEN, `Name must be ${MAX_DISPLAY_NAME_LEN} characters or fewer`)
         .regex(ALLOWED, "Use letters, numbers, spaces, or - _ . '"),
   );

export type ValidateNameResult = { ok: true; name: string } | { ok: false; error: string };

export function validateDisplayName(input: string): ValidateNameResult {
   const parsed = DisplayNameSchema.safeParse(input);
   if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid name' };
   }
   return { ok: true, name: parsed.data };
}
