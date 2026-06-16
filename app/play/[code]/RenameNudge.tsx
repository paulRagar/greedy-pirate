'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser, isDefaultDisplayName } from '@/client/auth/useCurrentUser';
import { DisplayNameEditor } from '@/ui/display-name/DisplayNameEditor';

interface Props {
   /** True when the local user holds a seat in the room. */
   isSeated: boolean;
}

const DELAY_MS = 2000;
const STORAGE_KEY = 'gp:rename-nudged';

/**
 * Soft prompt that opens the rename modal a couple seconds after a player
 * is seated — but only if their name still looks auto-generated. Dismissal
 * is persisted per-user so we don't nag across sessions.
 */
export function RenameNudge({ isSeated }: Props) {
   const { profile } = useCurrentUser();
   const [open, setOpen] = useState(false);

   // useCurrentUser hands back a fresh profile object on every refetch
   // (same data, new reference). Depending on `profile` itself would
   // re-run this effect on every render and clear the 2s timer before
   // it can fire — manifests as "the nudge never opens" on slower
   // environments like CI. Depend on the value-level fields instead.
   const profileId = profile?.id;
   const displayName = profile?.displayName;
   const isAnonymous = profile?.isAnonymous ?? false;

   useEffect(() => {
      if (!isSeated || !profileId || !displayName) return;
      if (!isDefaultDisplayName(displayName)) return;
      if (typeof window === 'undefined') return;

      try {
         const flag = window.localStorage.getItem(STORAGE_KEY);
         const userIds = flag ? new Set(flag.split(',')) : new Set<string>();
         if (userIds.has(profileId)) return;
      } catch {
         // localStorage may be blocked (private mode, quota) — still prompt;
         // we just won't remember the dismissal.
      }

      const t = setTimeout(() => setOpen(true), DELAY_MS);
      return () => clearTimeout(t);
   }, [isSeated, profileId, displayName]);

   const remember = () => {
      if (!profileId) return;
      try {
         const flag = window.localStorage.getItem(STORAGE_KEY);
         const ids = new Set(flag ? flag.split(',') : []);
         ids.add(profileId);
         window.localStorage.setItem(STORAGE_KEY, Array.from(ids).join(','));
      } catch {
         // ignore
      }
   };

   if (!profileId || !displayName) return null;
   return (
      <DisplayNameEditor
         open={open}
         currentName={displayName}
         isAnonymous={isAnonymous}
         onClose={() => {
            remember();
            setOpen(false);
         }}
         onSaved={() => {
            remember();
         }}
      />
   );
}
