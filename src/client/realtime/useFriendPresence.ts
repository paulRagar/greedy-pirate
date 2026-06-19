'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabaseBrowser } from '@/client/supabase/browser';

const ROOM_PATH_RE = /^\/play\/([a-z0-9]{4})$/i;

/** What a friend is doing right now. Absent from the map ⇒ offline. */
export type FriendPresence = { code: string | null };

function presenceTopic(userId: string): string {
   return `presence:${userId}`;
}

function roomCodeFromPath(pathname: string | null): string | null {
   if (!pathname) return null;
   const m = pathname.match(ROOM_PATH_RE);
   return m ? m[1]!.toUpperCase() : null;
}

/**
 * Broadcast the signed-in user's presence on their own private topic
 * `presence:{id}` so friends can see them online + their current room. Always-on
 * for signed-in users (mounted once via the TopNav). Re-tracks when the room
 * changes and untracks while the tab is hidden so friends see an honest state.
 * Inert for anon. Mirrors the channel lifecycle of useKnockRequest (GRE-33).
 */
export function useOwnPresence(userId: string | null, isAnonymous: boolean): void {
   const pathname = usePathname();
   const code = roomCodeFromPath(pathname);
   const codeRef = useRef(code);
   codeRef.current = code;

   useEffect(() => {
      if (!userId || isAnonymous) return;
      const supabase = getSupabaseBrowser();
      const topic = presenceTopic(userId);
      let channel: ReturnType<typeof supabase.channel> | null = null;
      let cancelled = false;

      const track = () => {
         if (channel) void channel.track({ online_at: new Date().toISOString(), code: codeRef.current });
      };

      const subscribe = async () => {
         await supabase.realtime.setAuth();
         if (cancelled) return;
         const fullTopic = `realtime:${topic}`;
         await Promise.all(
            (supabase.getChannels() as Array<ReturnType<typeof supabase.channel>>)
               .filter((c) => c.topic === fullTopic)
               .map((c) => supabase.removeChannel(c)),
         );
         if (cancelled) return;
         channel = supabase.channel(topic, {
            config: { private: true, presence: { key: userId } },
         });
         channel.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') track();
         });
      };

      const onVisibility = () => {
         if (document.visibilityState === 'hidden') void channel?.untrack();
         else track();
      };
      document.addEventListener('visibilitychange', onVisibility);

      void subscribe();

      return () => {
         cancelled = true;
         document.removeEventListener('visibilitychange', onVisibility);
         if (channel) void supabase.removeChannel(channel);
      };
   }, [userId, isAnonymous]);

   // Re-track when the room code changes (without resubscribing).
   useEffect(() => {
      if (!userId || isAnonymous) return;
      const supabase = getSupabaseBrowser();
      const fullTopic = `realtime:${presenceTopic(userId)}`;
      const channel = (supabase.getChannels() as Array<ReturnType<typeof supabase.channel>>).find(
         (c) => c.topic === fullTopic,
      );
      if (channel) void channel.track({ online_at: new Date().toISOString(), code });
   }, [code, userId, isAnonymous]);
}

/**
 * Read presence for a set of friends by subscribing to each friend's
 * `presence:{id}` topic (RLS-gated to friends). Returns a map of friendId →
 * presence; a missing entry means offline. Enabled only while needed (e.g. the
 * drawer is open) to keep channel count bounded. Channels multiplex over one
 * socket.
 */
export function useFriendsPresence(
   friendIds: string[],
   enabled: boolean,
): Map<string, FriendPresence> {
   const [map, setMap] = useState<Map<string, FriendPresence>>(new Map());
   // Stable key so the effect only re-runs when the actual id set changes.
   const idsKey = [...friendIds].sort().join(',');

   useEffect(() => {
      if (!enabled || friendIds.length === 0) {
         setMap(new Map());
         return;
      }
      const supabase = getSupabaseBrowser();
      const ids = idsKey ? idsKey.split(',') : [];
      const channels: Array<ReturnType<typeof supabase.channel>> = [];
      let cancelled = false;

      const sync = (id: string, channel: ReturnType<typeof supabase.channel>) => {
         const state = channel.presenceState() as Record<
            string,
            Array<{ code?: string | null }>
         >;
         const metas = Object.values(state).flat();
         setMap((prev) => {
            const next = new Map(prev);
            if (metas.length === 0) {
               next.delete(id);
            } else {
               const code = metas.find((m) => m.code)?.code ?? null;
               next.set(id, { code });
            }
            return next;
         });
      };

      const subscribe = async () => {
         await supabase.realtime.setAuth();
         if (cancelled) return;
         for (const id of ids) {
            const channel = supabase.channel(presenceTopic(id), {
               config: { private: true, presence: { key: id } },
            });
            channel
               .on('presence', { event: 'sync' }, () => sync(id, channel))
               .on('presence', { event: 'join' }, () => sync(id, channel))
               .on('presence', { event: 'leave' }, () => sync(id, channel))
               .subscribe();
            channels.push(channel);
         }
      };

      void subscribe();

      return () => {
         cancelled = true;
         for (const c of channels) void supabase.removeChannel(c);
      };
   }, [idsKey, enabled, friendIds.length]);

   return map;
}
