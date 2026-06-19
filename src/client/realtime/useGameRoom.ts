'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { gateStateVersion } from '@/client/realtime/versionGate';
import type { PublicGameState, RoomSpectatorView } from '@/game/public';

const ROOM_BROADCAST_EVENT = 'state';
const KNOCK_REQUESTED_EVENT = 'knock:requested';
const KNOCK_CANCELLED_EVENT = 'knock:cancelled';
const KNOCK_RESOLVED_EVENT = 'knock:resolved';

/**
 * How long a player can vanish from the presence channel before we
 * surface them as "gone" to other players in the room. Tuned per game
 * phase — the lobby snaps quickly (no consequence to false-positives,
 * easy to rejoin), the active game waits longer so a brief wifi blip
 * doesn't trigger a forfeit.
 */
const LOBBY_GRACE_MS = 2_500;
const ACTIVE_GRACE_MS = 10_000;

export type ContinuationContext = {
   deadlineAt: string;
   continuedIds: ReadonlyArray<string>;
   seatedIds: ReadonlyArray<string>;
} | null;

type BroadcastBody = {
   state?: PublicGameState;
   spectators?: ReadonlyArray<RoomSpectatorView>;
   actorId?: string | null;
   eventType?: string;
   /** Monotonic version (game_events.seq) of a game-advancing broadcast. */
   version?: number;
   continuation?: ContinuationContext;
   hostId?: string;
   /** Achievements unlocked by this game's completion, keyed by user id. */
   unlocks?: Record<string, string[]>;
};

export type KnockRequestedEvent = {
   requestId: string;
   requesterId: string;
   displayName: string;
   kind: 'player' | 'spectator';
   expiresAt: string;
};

export type KnockCancelledEvent = {
   requestId: string;
   requesterId: string;
};

export type KnockResolvedEvent = {
   requestId: string;
   requesterId: string;
   outcome: 'approved' | 'denied' | 'expired' | 'cancelled';
};

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'paused' | 'error';

type Options = {
   onResume?: () => void;
   /** Local user id — needed to track our own presence on the channel. */
   userId?: string;
   onKnockRequested?: (event: KnockRequestedEvent) => void;
   onKnockCancelled?: (event: KnockCancelledEvent) => void;
   onKnockResolved?: (event: KnockResolvedEvent) => void;
   onEvent?: (eventType: string, body: BroadcastBody) => void;
};

type PresenceMeta = { user_id: string; online_at: string };

export function useGameRoom(
   gameId: string,
   code: string,
   initial: PublicGameState,
   options: Options = {},
   initialSpectators: ReadonlyArray<RoomSpectatorView> = [],
   initialContinuation: ContinuationContext = null,
   initialVersion = 0,
) {
   const [state, setState] = useState<PublicGameState>(initial);
   const [spectators, setSpectators] = useState<ReadonlyArray<RoomSpectatorView>>(initialSpectators);
   const [status, setStatus] = useState<RealtimeStatus>('connecting');
   const [onlineIds, setOnlineIds] = useState<ReadonlySet<string>>(() => new Set());
   const [continuation, setContinuation] = useState<ContinuationContext>(initialContinuation);
   // Highest applied broadcast version (game_events.seq). Out-of-order or late
   // broadcasts with a version ≤ this are dropped so an older state can't
   // clobber a newer one. An optimistic local reduce leaves this untouched, so
   // a late pre-action broadcast (whose version equals the base it reduced
   // from) is dropped, while the server's confirming broadcast (next seq)
   // reconciles it.
   const appliedVersion = useRef(initialVersion);
   const onResumeRef = useRef(options.onResume);
   const userIdRef = useRef(options.userId);
   const onKnockRequestedRef = useRef(options.onKnockRequested);
   const onKnockCancelledRef = useRef(options.onKnockCancelled);
   const onKnockResolvedRef = useRef(options.onKnockResolved);
   const onEventRef = useRef(options.onEvent);
   const statusRef = useRef<PublicGameState['status']>(initial.status);
   statusRef.current = state.status;

   const graceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

   useEffect(() => {
      onResumeRef.current = options.onResume;
      userIdRef.current = options.userId;
      onKnockRequestedRef.current = options.onKnockRequested;
      onKnockCancelledRef.current = options.onKnockCancelled;
      onKnockResolvedRef.current = options.onKnockResolved;
      onEventRef.current = options.onEvent;
   }, [
      options.onResume,
      options.userId,
      options.onKnockRequested,
      options.onKnockCancelled,
      options.onKnockResolved,
      options.onEvent,
   ]);

   // RSC-provided initial state. On a genuine game switch (new gameId) we
   // always reset and re-seat the version watermark. On a same-game RSC
   // refresh — notably the resume after a backgrounded tab — we only apply
   // the fetched state if its version is newer than what realtime already
   // delivered, so the refresh can't race-clobber a fresher broadcast.
   const prevGameId = useRef(gameId);
   useEffect(() => {
      if (prevGameId.current !== gameId) {
         prevGameId.current = gameId;
         appliedVersion.current = initialVersion;
         setState(initial);
         return;
      }
      const gate = gateStateVersion(appliedVersion.current, initialVersion);
      if (gate.apply) {
         appliedVersion.current = gate.nextVersion;
         setState(initial);
      }
   }, [gameId, initial, initialVersion]);

   useEffect(() => {
      setSpectators(initialSpectators);
   }, [gameId, initialSpectators]);

   useEffect(() => {
      setContinuation(initialContinuation);
   }, [gameId, initialContinuation]);

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
            const next = new Set(prev);
            for (const uid of liveIds) {
               clearGraceTimer(uid);
               next.add(uid);
            }
            for (const uid of prev) {
               if (!liveIds.has(uid)) {
                  startGraceTimer(uid);
               }
            }
            return next;
         });
      };

      const subscribe = async () => {
         if (channel) return;
         // Room topics are private channels — RLS on realtime.messages only
         // lets seated players / host / spectators read or send. Attach the
         // current session JWT to the realtime socket before subscribing.
         await supabase.realtime.setAuth();
         if (channel) return; // a concurrent resume may have beaten us here
         // Drop any same-topic channel left over from a prior mount or a
         // backgrounded-tab resume whose fire-and-forget removeChannel hasn't
         // finished. Otherwise supabase collides with an already-subscribed
         // channel: .on('presence', …) throws "after subscribe()", or it
         // resubscribes without the freshly-set JWT and RLS denies the read.
         const fullTopic = `realtime:${topic}`;
         await Promise.all(
            (supabase.getChannels() as Array<ReturnType<typeof supabase.channel>>)
               .filter((c) => c.topic === fullTopic)
               .map((c) => supabase.removeChannel(c)),
         );
         if (channel) return;
         channel = supabase.channel(topic, {
            config: {
               private: true,
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
                  const gate = gateStateVersion(appliedVersion.current, payload.version);
                  if (gate.apply) {
                     appliedVersion.current = gate.nextVersion;
                     setState(payload.state);
                  }
               }
               if (payload.spectators) {
                  setSpectators(payload.spectators);
               }
               // continuation explicitly null means the window closed.
               // undefined means the sender didn't address it — keep current.
               if (payload.continuation !== undefined) {
                  setContinuation(payload.continuation);
               }
               if (payload.eventType) {
                  onEventRef.current?.(payload.eventType, payload);
               }
            },
         );

         channel.on(
            'broadcast',
            { event: KNOCK_REQUESTED_EVENT },
            (message: { payload?: KnockRequestedEvent }) => {
               if (message.payload) onKnockRequestedRef.current?.(message.payload);
            },
         );
         channel.on(
            'broadcast',
            { event: KNOCK_CANCELLED_EVENT },
            (message: { payload?: KnockCancelledEvent }) => {
               if (message.payload) onKnockCancelledRef.current?.(message.payload);
            },
         );
         channel.on(
            'broadcast',
            { event: KNOCK_RESOLVED_EVENT },
            (message: { payload?: KnockResolvedEvent }) => {
               if (message.payload) onKnockResolvedRef.current?.(message.payload);
            },
         );

         channel.on('presence', { event: 'sync' }, syncPresence);
         channel.on('presence', { event: 'join' }, syncPresence);
         channel.on('presence', { event: 'leave' }, syncPresence);

         channel.subscribe(async (subStatus: string, err?: Error) => {
            if (subStatus === 'SUBSCRIBED') {
               setStatus('connected');
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
            void subscribe();
            onResumeRef.current?.();
         }
      };

      if (typeof document === 'undefined' || !document.hidden) {
         void subscribe();
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

   return { state, spectators, status, applyOptimistic, onlineIds, continuation };
}
