/**
 * Display-name primitives shared by client + server. Pure module —
 * no React, no Supabase, no DB access — so it can be unit-tested in
 * isolation and consumed from either runtime.
 */

export const DEFAULT_DISPLAY_NAME = 'Crewmate';

const DEFAULT_NAME_PATTERN = /^Crewmate(?: #\d+)?$/;

/** True when the name still looks auto-generated ('Crewmate' or 'Crewmate #1234'). */
export function isDefaultDisplayName(name: string | null | undefined): boolean {
   if (!name) return false;
   return DEFAULT_NAME_PATTERN.test(name);
}
