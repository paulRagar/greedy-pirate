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

   useEffect(() => {
      if (!isSeated || !profile) return;
      if (!isDefaultDisplayName(profile.displayName)) return;
      if (typeof window === 'undefined') return;

      try {
         const flag = window.localStorage.getItem(STORAGE_KEY);
         const userIds = flag ? new Set(flag.split(',')) : new Set<string>();
         if (userIds.has(profile.id)) return;
      } catch {
         // localStorage may be blocked (private mode, quota) — still prompt;
         // we just won't remember the dismissal.
      }

      const t = setTimeout(() => setOpen(true), DELAY_MS);
      return () => clearTimeout(t);
   }, [isSeated, profile]);

   const remember = () => {
      if (!profile) return;
      try {
         const flag = window.localStorage.getItem(STORAGE_KEY);
         const ids = new Set(flag ? flag.split(',') : []);
         ids.add(profile.id);
         window.localStorage.setItem(STORAGE_KEY, Array.from(ids).join(','));
      } catch {
         // ignore
      }
   };

   if (!profile) return null;
   return (
      <DisplayNameEditor
         open={open}
         currentName={profile.displayName}
         isAnonymous={profile.isAnonymous}
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
