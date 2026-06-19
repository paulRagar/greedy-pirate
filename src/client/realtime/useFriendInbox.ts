'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { listIncomingRequests } from '@/server/actions/friendActions';

const FRIEND_REQUESTED_EVENT = 'friend:requested';
const FRIEND_RESOLVED_EVENT = 'friend:resolved';

/** Live incoming friend request — drives the on-screen notice. */
export type FriendNotice = {
   requestId: string;
   fromUserId: string;
   fromDisplayName: string;
};

export type FriendInbox = {
   /** Pending incoming requests — the TopNav badge count. */
   unread: number;
   /** Newest live incoming request to surface as a notice, or null. */
   notice: FriendNotice | null;
   dismissNotice: () => void;
   /** Bumped whenever the graph changes server-side; open panels refetch on it. */
   version: number;
   /** Recipient acted on an incoming request (accept/decline): drop one + refetch. */
   onIncomingResolved: () => void;
   /** Re-pull the authoritative pending-incoming count from the server. */
   refreshUnread: () => void;
};

/**
 * App-wide friend notification subscriber. Mounted once (in the TopNav), it
 * listens on the user's private `user:{id}` topic — the same per-user channel
 * the knock verdict uses (see {@link useKnockRequest}) — for `friend:requested`
 * (bump badge + raise a notice) and `friend:resolved` (a sent request was
 * accepted/declined; refetch outgoing). Anonymous users get an inert inbox.
 */
export function useFriendInbox(userId: string | null, isAnonymous: boolean): FriendInbox {
   const [unread, setUnread] = useState(0);
   const [notice, setNotice] = useState<FriendNotice | null>(null);
   const [version, setVersion] = useState(0);

   const refreshUnread = useCallback(() => {
      if (!userId || isAnonymous) return;
      listIncomingRequests()
         .then((res) => {
            if (res.ok) setUnread(res.requests.length);
         })
         .catch(() => {
            /* leave the last known count on transient failure */
         });
   }, [userId, isAnonymous]);

   const dismissNotice = useCallback(() => setNotice(null), []);

   const onIncomingResolved = useCallback(() => {
      setUnread((u) => Math.max(0, u - 1));
      setVersion((v) => v + 1);
   }, []);

   // Seed the count whenever the signed-in user changes.
   useEffect(() => {
      if (!userId || isAnonymous) {
         setUnread(0);
         setNotice(null);
         return;
      }
      refreshUnread();
   }, [userId, isAnonymous, refreshUnread]);

   // Subscribe to the private per-user topic.
   useEffect(() => {
      if (!userId || isAnonymous) return;
      const supabase = getSupabaseBrowser();
      const topic = `user:${userId}`;
      let channel: ReturnType<typeof supabase.channel> | null = null;
      let cancelled = false;

      const subscribe = async () => {
         await supabase.realtime.setAuth();
         if (cancelled) return;
         // Tear down any stale same-topic channel from a prior mount whose
         // fire-and-forget removeChannel hasn't completed, so we don't
         // resubscribe without the freshly-set JWT (RLS would deny). Mirrors
         // the GRE-33 fix in useKnockRequest.
         const fullTopic = `realtime:${topic}`;
         await Promise.all(
            (supabase.getChannels() as Array<ReturnType<typeof supabase.channel>>)
               .filter((c) => c.topic === fullTopic)
               .map((c) => supabase.removeChannel(c)),
         );
         if (cancelled) return;
         channel = supabase.channel(topic, {
            config: { private: true, broadcast: { self: false, ack: false } },
         });
         channel.on(
            'broadcast',
            { event: FRIEND_REQUESTED_EVENT },
            (message: { payload?: FriendNotice }) => {
               const p = message.payload;
               if (!p) return;
               setUnread((u) => u + 1);
               setVersion((v) => v + 1);
               setNotice(p);
            },
         );
         channel.on('broadcast', { event: FRIEND_RESOLVED_EVENT }, () => {
            // A request we SENT was accepted/declined — outgoing changed.
            setVersion((v) => v + 1);
         });
         channel.subscribe();
      };

      void subscribe();

      return () => {
         cancelled = true;
         if (channel) void supabase.removeChannel(channel);
      };
   }, [userId, isAnonymous]);

   return { unread, notice, dismissNotice, version, onIncomingResolved, refreshUnread };
}
