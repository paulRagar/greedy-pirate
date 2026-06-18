/**
 * Mask an email address for display on potentially-observable surfaces
 * (screen-share, screenshots): keep enough to disambiguate, hide the rest.
 *
 *   alice@example.com   -> a••••@example.com
 *   bo@example.com      -> b•@example.com
 *   x@example.com       -> •@example.com  (single-char locals are fully masked)
 *
 * The domain is preserved (useful for admin triage, low PII value). Returns
 * null for null/empty input and a generic mask for anything that doesn't look
 * like an email.
 */
export function maskEmail(email: string | null | undefined): string | null {
   if (!email) return null;
   const at = email.lastIndexOf('@');
   if (at <= 0) return '••••';

   const local = email.slice(0, at);
   const domain = email.slice(at + 1);
   // A single-char local part would otherwise be fully revealed; mask it too.
   const masked =
      local.length <= 1 ? '•' : local[0] + '•'.repeat(local.length - 1);
   return `${masked}@${domain}`;
}
