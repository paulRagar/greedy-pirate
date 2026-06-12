'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import type { PublicGameState, RoomSpectatorView } from '@/game/public';

const ROOM_BROADCAST_EVENT = 'state';

/**
 * How long a player can vanish from the presence channel before we
 * surface them as "gone" to other players in the room. Tuned per game
 * phase — the lobby snaps quickly (no consequence to false-positives,
 * easy to rejoin), the active game waits longer so a brief wifi blip
 * doesn't trigger a forfeit.
 */
const LOBBY_GRACE_MS = 2_500;
const ACTIVE_GRACE_MS = 10_000;

type BroadcastBody = {
   state?: PublicGameState;
   spectators?: ReadonlyArray<RoomSpectatorView>;
   actorId?: string | null;
   eventType?: string;
};

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'paused' | 'error';

type Options = {
   onResume?: () => void;
   /** Local user id — needed to track our own presence on the channel. */
   userId?: string;
};

type PresenceMeta = { user_id: string; online_at: string };

export function useGameRoom(
   gameId: string,
   code: string,
   initial: PublicGameState,
   options: Options = {},
   initialSpectators: ReadonlyArray<RoomSpectatorView> = [],
) {
   const [state, setState] = useState<PublicGameState>(initial);
   const [spectators, setSpectators] = useState<ReadonlyArray<RoomSpectatorView>>(initialSpectators);
   const [status, setStatus] = useState<RealtimeStatus>('connecting');
   const [onlineIds, setOnlineIds] = useState<ReadonlySet<string>>(() => new Set());
   const optimisticVersion = useRef(0);
   const onResumeRef = useRef(options.onResume);
   const userIdRef = useRef(options.userId);
   // Read latest game status inside presence timers so each grace window
   // uses the right duration at the moment it starts.
   const statusRef = useRef<PublicGameState['status']>(initial.status);
   statusRef.current = state.status;

   // Track ids that left + the timer that will mark them offline after the
   // grace window expires. If they rejoin during the grace, we cancel.
   const graceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

   useEffect(() => {
      onResumeRef.current = options.onResume;
      userIdRef.current = options.userId;
   }, [options.onResume, options.userId]);

   useEffect(() => {
      setState(initial);
   }, [gameId, initial]);

   useEffect(() => {
      setSpectators(initialSpectators);
   }, [gameId, initialSpectators]);

   useEffect(() => {
      const supabase = getSupabaseBrowser();
      const topic = `room:${code.toUpperCase()}`;
      let channel: ReturnType<typeof supabase.channel> | null = null;

      const clearGraceTimer = (uid: string) => {
         const timer = graceTimers.current.get(uid);
         if (timer) {
            clearTimeout(timer);
            graceTimers.current.delete(uid);
         }
      };

      const startGraceTimer = (uid: string) => {
         clearGraceTimer(uid);
         const graceMs = statusRef.current === 'lobby' ? LOBBY_GRACE_MS : ACTIVE_GRACE_MS;
         const timer = setTimeout(() => {
            graceTimers.current.delete(uid);
            setOnlineIds((prev) => {
               if (!prev.has(uid)) return prev;
               const next = new Set(prev);
               next.delete(uid);
               return next;
            });
         }, graceMs);
         graceTimers.current.set(uid, timer);
      };

      const syncPresence = () => {
         if (!channel) return;
         const presence = channel.presenceState() as Record<string, PresenceMeta[]>;
         const liveIds = new Set<string>();
         for (const metas of Object.values(presence)) {
            for (const meta of metas) {
               if (meta.user_id) liveIds.add(meta.user_id);
            }
         }
         setOnlineIds((prev) => {
            // Anyone newly live: clear any pending grace timer + add.
            const next = new Set(prev);
            for (const uid of liveIds) {
               clearGraceTimer(uid);
               next.add(uid);
            }
            // Anyone in prev but not live: start grace timer (don't remove yet).
            for (const uid of prev) {
               if (!liveIds.has(uid)) {
                  startGraceTimer(uid);
               }
            }
            return next;
         });
      };

      const subscribe = () => {
         if (channel) return;
         channel = supabase.channel(topic, {
            config: {
               broadcast: { self: true, ack: false },
               presence: { key: userIdRef.current ?? `anon-${Math.random().toString(36).slice(2, 10)}` },
            },
         });

         channel.on(
            'broadcast',
            { event: ROOM_BROADCAST_EVENT },
            (message: { payload?: BroadcastBody }) => {
               const payload = message.payload ?? {};
               if (payload.state) {
                  optimisticVersion.current += 1;
                  setState(payload.state);
               }
               if (payload.spectators) {
                  setSpectators(payload.spectators);
               }
            },
         );

         channel.on('presence', { event: 'sync' }, syncPresence);
         channel.on('presence', { event: 'join' }, syncPresence);
         channel.on('presence', { event: 'leave' }, syncPresence);

         channel.subscribe(async (subStatus: string, err?: Error) => {
            if (subStatus === 'SUBSCRIBED') {
               setStatus('connected');
               // Announce ourselves on the presence channel.
               if (userIdRef.current && channel) {
                  await channel.track({
                     user_id: userIdRef.current,
                     online_at: new Date().toISOString(),
                  } satisfies PresenceMeta);
               }
            } else if (subStatus === 'CHANNEL_ERROR') setStatus('error');
            else if (subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') setStatus('reconnecting');
            if (err) console.error('[useGameRoom] subscribe error', err);
         });
      };

      const unsubscribe = () => {
         if (!channel) return;
         void channel.untrack().catch(() => {});
         void supabase.removeChannel(channel);
         channel = null;
      };

      const handleVisibility = () => {
         if (typeof document === 'undefined') return;
         if (document.hidden) {
            setStatus('paused');
            unsubscribe();
         } else {
            subscribe();
            onResumeRef.current?.();
         }
      };

      if (typeof document === 'undefined' || !document.hidden) {
         subscribe();
      } else {
         setStatus('paused');
      }

      document.addEventListener('visibilitychange', handleVisibility);

      const timers = graceTimers.current;
      return () => {
         document.removeEventListener('visibilitychange', handleVisibility);
         unsubscribe();
         for (const t of timers.values()) clearTimeout(t);
         timers.clear();
      };
   }, [code]);

   const applyOptimistic = useCallback(
      (mutator: (prev: PublicGameState) => PublicGameState) => {
         setState((prev) => mutator(prev));
      },
      [],
   );

   return { state, spectators, status, applyOptimistic, onlineIds };
}
