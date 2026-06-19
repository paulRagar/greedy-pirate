'use client';

import { useOwnPresence } from '@/client/realtime/useFriendPresence';

/**
 * Headless: broadcasts the signed-in user's presence app-wide so friends see
 * them online + their current room. Mounted once in the TopNav. Renders nothing.
 */
export function OwnPresenceTracker({
   userId,
   isAnonymous,
}: {
   userId: string | null;
   isAnonymous: boolean;
}) {
   useOwnPresence(userId, isAnonymous);
   return null;
}
