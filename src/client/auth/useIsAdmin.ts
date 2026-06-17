'use client';

import { useMemo } from 'react';
import { useCurrentUser } from './useCurrentUser';

function parseAdminEmails(): Set<string> {
   const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '';
   return new Set(
      raw
         .split(',')
         .map((s) => s.trim().toLowerCase())
         .filter(Boolean),
   );
}

// Client-side UI gate only. Server actions and the /admin route still
// enforce admin via ADMIN_EMAILS — flipping this in devtools just shows
// the link, it does not grant access.
export function useIsAdmin(): boolean {
   const { user } = useCurrentUser();
   return useMemo(() => {
      const email = user?.email?.toLowerCase();
      if (!email) return false;
      return parseAdminEmails().has(email);
   }, [user?.email]);
}
