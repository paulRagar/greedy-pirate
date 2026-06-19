'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
   useGameRoom,
   type ContinuationContext,
   type RealtimeStatus,
   type KnockRequestedEvent,
} from '@/client/realtime/useGameRoom';
import { useGameJuice, type JuiceSnapshot } from '@/client/hooks/useGameJuice';
import { useGameAnnouncer } from '@/client/hooks/useGameAnnouncer';
import type { AnnounceSnapshot } from '@/client/a11y/gameAnnouncement';
import type { PublicGameState, RoomState, RoomSpectatorView } from '@/game/public';
import {
   bankOnline,
   drawOnline,
   leaveActiveGame,
   markPresentOnline,
   skipAbsentTurn,
   timeoutTurn,
} from '@/server/actions/gameTurnActions';
import { startOnlineGame } from '@/server/actions/startOnlineGame';
import { setReady, beginBoarding, startGameDroppingUnready } from '@/server/actions/readyActions';
import { endGameByForfeit } from '@/server/actions/restartRoom';
import { leaveSpectator } from '@/server/actions/spectatorActions';
import { leaveRoom } from '@/server/actions/joinRoom';
import { listPendingKnocks } from '@/server/actions/listPendingKnocks';
import { setRoomVisibility } from '@/server/actions/setRoomVisibility';
import { leaveAsHost } from '@/server/actions/leaveAsHost';
import { claimWheelIfOrphaned } from '@/server/actions/claimWheelIfOrphaned';
import { continueIntoNextRound } from '@/server/actions/continueIntoNextRound';
import { jumpShip } from '@/server/actions/jumpShip';
import { finalizeContinuation } from '@/server/actions/finalizeContinuation';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateCard } from '@/ui/pirate-card/PirateCard';
import { PirateModal } from '@/ui/pirate-modal/PirateModal';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { BustVignette } from '@/ui/effects/BustVignette';
import { ChestBurst } from '@/ui/effects/ChestBurst';
import { CrewGrid } from '@/ui/game-room/CrewGrid';
import { ScoreRibbon } from '@/ui/game-room/ScoreRibbon';
import { StreakStrip } from '@/ui/game-room/StreakStrip';
import { TurnClock, useCountdown } from '@/ui/game-room/TurnClock';
import { VictoryModal } from '@/ui/game-room/VictoryModal';
import { useGameToast } from '@/ui/toast/PirateToast';
import {
   BOARDING_COUNTDOWN_MS,
   MAX_PLAYERS,
   MIN_PLAYERS,
   PIRATE_PASS_MS,
   TURN_CLOCK_MS,
} from '@/game/rules';
import { cn } from '@/lib/cn';
import KnockInbox, { type KnockEntry } from './KnockInbox';
import HostLeaveModal, { type Candidate } from './HostLeaveModal';
import LeaveConfirmModal, { type LeaveConfirmKind } from './LeaveConfirmModal';
import CaptainMenu from './CaptainMenu';
import { LobbyRenameButton } from './LobbyRenameButton';
import { RenameNudge } from './RenameNudge';
import { SKIP_LEAVE_BEACON_KEY } from '@/lib/leaveBeacon';

interface Props {
   gameId: string;
   userId: string;
   initial: RoomState;
   isPublic: boolean;
   initialContinuation: ContinuationContext;
   initialVersion: number;
   initialTurnDeadline: string | null;
   initialReadyIds: string[];
}

export default function OnlineRoomClient({
   gameId,
   userId,
   initial,
   isPublic,
   initialContinuation,
   initialVersion,
   initialTurnDeadline,
   initialReadyIds,
}: Props) {
   const router = useRouter();
   const [leaving, startLeave] = useTransition();
   const goToLobby = useCallback(() => {
      startLeave(() => router.push('/play/lobby'));
   }, [router]);
   const wasMember = useRef(initial.players.some((p) => p.id === userId));
   const [knocks, setKnocks] = useState<KnockEntry[]>([]);
   const [hostLeaveCandidates, setHostLeaveCandidates] = useState<Candidate[] | null>(null);
   const [leaveConfirm, setLeaveConfirm] = useState<
      | { kind: LeaveConfirmKind; destination: string | null; submitting: boolean }
      | null
   >(null);
   const [plankedReason, setPlankedReason] = useState<'kicked' | 'hesitated' | null>(null);
   // Absolute epoch-ms deadline of an in-progress lobby boarding countdown,
   // or null when none is running. Set by the host on begin, and by everyone
   // on the BOARDING_STARTED broadcast.
   const [boardingUntil, setBoardingUntil] = useState<number | null>(null);
   // Brief "settin' sail" beat shown over the lobby→active hand-off.
   const [settingSail, setSettingSail] = useState(false);
   const { showToast, toastElement: globalToast } = useGameToast();

   const removeKnock = useCallback((requestId: string) => {
      setKnocks((prev) => prev.filter((k) => k.requestId !== requestId));
   }, []);

   const onKnockRequested = useCallback((e: KnockRequestedEvent) => {
      setKnocks((prev) => {
         if (prev.some((k) => k.requestId === e.requestId)) return prev;
         return [...prev, e];
      });
   }, []);

   const {
      state: live,
      spectators,
      status,
      applyOptimistic,
      onlineIds,
      continuation,
      turnDeadline,
      readyIds,
   } = useGameRoom(
      gameId,
      initial.code,
      initial,
      {
         onResume: () => router.refresh(),
         userId,
         onKnockRequested,
         onKnockCancelled: (e) => removeKnock(e.requestId),
         onKnockResolved: (e) => removeKnock(e.requestId),
         onEvent: (eventType, body) => {
            // Apply hostId straight from the broadcast so the new captain
            // gets their notice immediately — no router.refresh roundtrip.
            const broadcastHostId = (body as { hostId?: string } | undefined)?.hostId;
            if (broadcastHostId) {
               if (broadcastHostId !== prevHostId.current) {
                  if (broadcastHostId === userId && prevHostId.current !== userId) {
                     showToast('The wheel be yours — yer the captain now! 🧭', 'gold', 6000, true);
                  }
                  prevHostId.current = broadcastHostId;
               }
               setHostId(broadcastHostId);
            } else if (eventType === 'HOST_CHANGED') {
               // Fallback for legacy broadcasts without hostId.
               router.refresh();
            }
            if (eventType === 'ROOM_ABANDONED') router.push('/play/lobby');
            if (eventType === 'BOARDING_STARTED') {
               const dl = (body as { boardingDeadline?: string | null }).boardingDeadline;
               setBoardingUntil(dl ? Date.parse(dl) : null);
            }
            // Achievements unlocked by this game's completion. Everyone in the
            // room gets the payload; we badge every achiever on the scoreboard
            // and surface the local player's own unlocks inside the victory
            // modal (a toast would render behind the modal backdrop).
            if (body.unlocks) {
               const achievers = Object.keys(body.unlocks);
               if (achievers.length > 0) setAchieverIds(new Set(achievers));
               const mine = body.unlocks[userId];
               if (mine && mine.length > 0) setMyUnlocks(mine);
            }
         },
      },
      initial.spectators,
      initialContinuation,
      initialVersion,
      initialTurnDeadline,
      initialReadyIds,
   );

   const [hostId, setHostId] = useState<string>(initial.hostId);
   const prevHostId = useRef<string>(initial.hostId);
   // User ids who unlocked an achievement this game (badged on the scoreboard)
   // and the local player's own newly-unlocked codes (shown in the victory
   // modal). Cleared when a new round starts.
   const [achieverIds, setAchieverIds] = useState<ReadonlySet<string>>(() => new Set());
   const [myUnlocks, setMyUnlocks] = useState<readonly string[]>([]);
   useEffect(() => {
      if (live.status !== 'complete') {
         setAchieverIds(new Set());
         setMyUnlocks([]);
      }
   }, [live.status]);
   // "Settin' sail" beat over the lobby→active hand-off. Also clears any
   // boarding countdown once we've actually sailed.
   const sailPrevStatus = useRef(initial.status);
   useEffect(() => {
      if (sailPrevStatus.current === 'lobby' && live.status === 'active') {
         setBoardingUntil(null);
         setSettingSail(true);
         const t = setTimeout(() => setSettingSail(false), 1600);
         sailPrevStatus.current = live.status;
         return () => clearTimeout(t);
      }
      sailPrevStatus.current = live.status;
   }, [live.status]);
   useEffect(() => {
      if (initial.hostId !== prevHostId.current) {
         if (initial.hostId === userId && prevHostId.current !== userId) {
            showToast('The wheel be yours — yer the captain now! 🧭', 'gold', 6000, true);
         }
         prevHostId.current = initial.hostId;
      }
      setHostId(initial.hostId);
      // showToast is stable (from useGameToast); excluded to avoid re-running.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [initial.hostId, userId]);

   const didContinueRef = useRef(false);
   const lastStatusRef = useRef<PublicGameState['status']>(initial.status);

   const state: RoomState = { ...live, code: initial.code, hostId, spectators };
   const isHost = userId === hostId;
   const isSeated = state.players.some((p) => p.id === userId);
   const isSpectator = !isHost && !isSeated;

   // Detect "I'm no longer aboard." Categorize so the right modal opens:
   //   - Game was 'complete' + I never clicked Continue → hesitation plank
   //   - Otherwise → kicked / forced out
   //
   // Read lastStatusRef BEFORE updating it so transitioning out of
   // 'complete' is still observable. Combining both responsibilities into
   // a single effect avoids the React effect-ordering hazard where a
   // separate status-tracker would overwrite the ref before this runs.
   const navigatingOutRef = useRef(false);
   useEffect(() => {
      const prevStatus = lastStatusRef.current;
      const nextStatus = live.status;

      if (prevStatus !== 'complete' && nextStatus === 'complete') {
         didContinueRef.current = false;
      }

      if (wasMember.current && !navigatingOutRef.current) {
         const stillSeated = continuation
            ? continuation.seatedIds.includes(userId)
            : state.players.some((p) => p.id === userId);

         if (!stillSeated) {
            const hesitated = prevStatus === 'complete' && !didContinueRef.current;
            // Outside of a hesitation context, the host can't be removed
            // from their own room — suppress false positives.
            if (hesitated || userId !== hostId) {
               navigatingOutRef.current = true;
               setPlankedReason(hesitated ? 'hesitated' : 'kicked');
            }
         }
      }

      lastStatusRef.current = nextStatus;
   }, [state.players, userId, hostId, continuation, live.status]);

   // Hydrate the host's knock inbox on mount + whenever host changes.
   useEffect(() => {
      if (!isHost) {
         setKnocks([]);
         return;
      }
      let cancelled = false;
      listPendingKnocks({ code: initial.code })
         .then((res) => {
            if (cancelled) return;
            if (res.ok) setKnocks(res.knocks);
         })
         .catch((err) => console.error('listPendingKnocks failed', err));
      return () => {
         cancelled = true;
      };
   }, [initial.code, isHost]);

   // Best-effort cleanup on tab close / page hide. Do NOT fire on the
   // effect cleanup — React StrictMode (Next dev) runs cleanup between
   // double-invoked mounts, which would beacon-leave the host as soon as
   // they land on the room page. SPA navigation-away without an explicit
   // leave button is handled by the cron safety net.
   useEffect(() => {
      // Clear any leftover skip-flag from a prior tab's reload now that
      // we're freshly mounted and presence is valid again.
      try {
         sessionStorage.removeItem(SKIP_LEAVE_BEACON_KEY);
      } catch {
         // private mode — nothing to do
      }

      const fire = () => {
         if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
         // Some flows (signin seat-transfer reload) intentionally reload
         // the page and want to come back as a still-seated member. Skip
         // the beacon when that flag is set so we don't yank our own
         // seat as the reload tears down the room page. Both
         // beforeunload AND pagehide fire on a reload — leave the flag
         // in place so both handlers honor it; the next mount clears it.
         try {
            if (sessionStorage.getItem(SKIP_LEAVE_BEACON_KEY) === '1') return;
         } catch {
            // private mode: fall through to the beacon
         }
         try {
            const blob = new Blob([JSON.stringify({ code: initial.code })], {
               type: 'application/json',
            });
            navigator.sendBeacon('/api/room/leave', blob);
         } catch {
            // Beacons can't surface errors.
         }
      };
      window.addEventListener('beforeunload', fire);
      window.addEventListener('pagehide', fire);
      return () => {
         window.removeEventListener('beforeunload', fire);
         window.removeEventListener('pagehide', fire);
      };
   }, [initial.code]);

   // Detect host disconnect via presence + presence-driven host claim.
   const earliestNonHost = useMemo(() => {
      const sorted = state.players
         .filter((p) => p.id !== hostId)
         .map((p) => p.id);
      return sorted[0] ?? null;
   }, [state.players, hostId]);
   const hostOffline = !onlineIds.has(hostId);
   const iAmSuccessor = earliestNonHost === userId;
   useEffect(() => {
      if (!hostOffline || !iAmSuccessor || isHost) return;
      const t = setTimeout(() => {
         void claimWheelIfOrphaned({ code: initial.code })
            .then((res) => {
               if (res.ok && res.claimed) {
                  setHostId(userId);
                  router.refresh();
               }
            })
            .catch((err) => console.error('claimWheelIfOrphaned failed', err));
      }, 30_000);
      return () => clearTimeout(t);
   }, [hostOffline, iAmSuccessor, isHost, initial.code, userId, router]);

   // Continuation handlers
   const iHaveContinued = !!continuation && continuation.continuedIds.includes(userId);
   const handleContinue = async () => {
      const res = await continueIntoNextRound({ code: initial.code });
      if (res.ok) didContinueRef.current = true;
      else showToast(res.error, 'blood');
   };
   const handleJumpShip = async () => {
      // Mark intent so the planked-by-hesitation detector doesn't fire.
      didContinueRef.current = true;
      const res = await jumpShip({ code: initial.code });
      if (!res.ok) showToast(res.error, 'blood');
      router.push('/play/lobby');
   };

   // Any client whose local timer hits zero calls finalize. The server
   // claim is atomic — losers no-op. If the call reports 'Window still
   // open' (local clock ahead of server), we retry on a 1s loop until
   // the broadcast lands and continuation flips to null. Local clock
   // can also lag the server, in which case the first call succeeds.
   useEffect(() => {
      if (!continuation) return;
      if (live.status !== 'complete') return;
      let cancelled = false;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;

      const fire = async () => {
         if (cancelled) return;
         try {
            const res = await finalizeContinuation({ code: initial.code });
            if (cancelled) return;
            if (res.ok) {
               // Trust the broadcast. router.refresh here would unmount us
               // BEFORE the plank-detection effect can fire — landing the
               // booted user on a freshly-rendered JoinGate instead of the
               // "you hesitated" modal.
               return;
            }
            if (res.error === 'Window still open') {
               retryTimer = setTimeout(fire, 1000);
            } else {
               console.warn('finalizeContinuation:', res.error);
               retryTimer = setTimeout(fire, 2000);
            }
         } catch (err) {
            console.error('finalizeContinuation threw', err);
            retryTimer = setTimeout(fire, 2000);
         }
      };

      const deadline = new Date(continuation.deadlineAt).getTime();
      const wait = Math.max(0, deadline - Date.now());
      const initialTimer = setTimeout(fire, wait);

      return () => {
         cancelled = true;
         clearTimeout(initialTimer);
         if (retryTimer) clearTimeout(retryTimer);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [continuation, live.status]);

   const [hostLeaveDestination, setHostLeaveDestination] = useState<string | null>(null);

   const onlineCrew = useMemo(
      () => state.players.filter((p) => p.id !== userId && onlineIds.has(p.id)),
      [state.players, userId, onlineIds],
   );
   const isSoloAboard = isHost && onlineCrew.length === 0;

   /**
    * Single entry point for "the player wants to leave". Picks the right
    * confirmation surface based on role + crew presence:
    *  - solo host        → "Go Down with the Ship" confirm (scuttles room)
    *  - host with crew   → Pass-the-Wheel modal (must nominate successor)
    *  - non-host         → "Jump Ship" confirm
    *
    * `destination` is the path to push to after a successful leave; null
    * means /play/lobby.
    */
   const requestLeave = useCallback(
      async (destination: string | null) => {
         if (leaveConfirm || hostLeaveCandidates) return;
         if (isHost && !isSoloAboard) {
            // Suppress the plank flash before the server broadcasts our
            // departure — the broadcast can race the HTTP response.
            navigatingOutRef.current = true;
            const res = await leaveAsHost({
               code: initial.code,
               onlineIds: Array.from(onlineIds),
            });
            if (res.ok) {
               router.push(destination ?? '/play/lobby');
               return;
            }
            // Server didn't let us go yet — restore the flag so a later
            // legitimate eviction can still surface the plank modal.
            navigatingOutRef.current = false;
            if ('mustNominate' in res) {
               setHostLeaveDestination(destination);
               setHostLeaveCandidates(res.candidates);
               return;
            }
            showToast(res.error, 'blood');
            return;
         }
         setLeaveConfirm({
            kind: isSoloAboard ? 'go-down' : 'jump',
            destination,
            submitting: false,
         });
      },
      [
         isHost,
         isSoloAboard,
         initial.code,
         onlineIds,
         router,
         showToast,
         leaveConfirm,
         hostLeaveCandidates,
      ],
   );

   const confirmLeave = async () => {
      if (!leaveConfirm) return;
      const { kind, destination } = leaveConfirm;
      setLeaveConfirm((prev) => (prev ? { ...prev, submitting: true } : null));
      // Suppress the plank flash up front — the engine broadcast that
      // removes us from state.players can outrun the HTTP response.
      navigatingOutRef.current = true;
      try {
         if (kind === 'go-down') {
            const res = await leaveAsHost({
               code: initial.code,
               onlineIds: Array.from(onlineIds),
            });
            if (!res.ok) {
               navigatingOutRef.current = false;
               if ('mustNominate' in res) {
                  // A crewmate reconnected between confirm and submit — fall
                  // through to the Pass-the-Wheel modal so the host names a
                  // successor instead of scuttling the ship.
                  setLeaveConfirm(null);
                  setHostLeaveDestination(destination);
                  setHostLeaveCandidates(res.candidates);
                  return;
               }
               showToast(res.error, 'blood');
               setLeaveConfirm((prev) => (prev ? { ...prev, submitting: false } : null));
               return;
            }
         } else if (state.status === 'active') {
            // Mark ourselves absent immediately so the table skips our seat
            // without waiting out the presence grace. The seat persists for
            // the scoreboard; we just navigate away.
            await leaveActiveGame({ code: initial.code });
         } else {
            await leaveRoom(initial.code);
         }
         router.push(destination ?? '/play/lobby');
      } catch (err) {
         navigatingOutRef.current = false;
         console.error('confirmLeave failed', err);
         setLeaveConfirm((prev) => (prev ? { ...prev, submitting: false } : null));
      }
   };

   const cancelLeave = () => {
      if (leaveConfirm?.submitting) return;
      setLeaveConfirm(null);
   };

   // Intercept SPA navigation away from the room so every exit hits one
   // of the confirmation modals. We capture-phase the click before Next's
   // Link handler sees it; for browser back/forward we re-push the
   // current entry to undo the pop, then route the confirm flow.
   // Spectators are exempt — they have their own leave button and aren't
   // bound to a seat that needs a confirmed exit.
   useEffect(() => {
      if (isSpectator) return;
      const here = `/play/${initial.code.toUpperCase()}`;
      const onClick = (e: MouseEvent) => {
         if (
            e.defaultPrevented ||
            e.button !== 0 ||
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey
         ) {
            return;
         }
         const anchor = (e.target as Element | null)?.closest?.('a[href]');
         if (!anchor) return;
         if (anchor.getAttribute('target') === '_blank') return;
         const raw = anchor.getAttribute('href');
         if (!raw) return;
         let url: URL;
         try {
            url = new URL(raw, window.location.origin);
         } catch {
            return;
         }
         if (url.origin !== window.location.origin) return;
         if (url.pathname.toUpperCase() === here) return;
         e.preventDefault();
         e.stopPropagation();
         void requestLeave(url.pathname + url.search);
      };
      const onPopState = () => {
         // Re-pin history to the room so the page stays put while the
         // confirm flow decides; if the user confirms, we navigate via
         // router.push; if they cancel, history is already correct.
         window.history.pushState(null, '', here);
         void requestLeave(null);
      };
      document.addEventListener('click', onClick, true);
      window.addEventListener('popstate', onPopState);
      return () => {
         document.removeEventListener('click', onClick, true);
         window.removeEventListener('popstate', onPopState);
      };
   }, [initial.code, isSpectator, requestLeave]);

   // Legacy wrapper for the existing Abandon Ship button binding.
   const handleLeaveHost = () => {
      void requestLeave(null);
   };

   // Wrapper for the Lobby's "Jump Ship" button (formerly "Disembark").
   // Named distinctly from `handleJumpShip` above — that one is the
   // continuation-window action ("opt out of the next round").
   const handleLeaveRoom = useCallback(() => {
      void requestLeave(null);
   }, [requestLeave]);

   const seatedIdSet = useMemo(
      () => (continuation ? new Set(continuation.seatedIds) : undefined),
      [continuation],
   );
   const pendingIds = useMemo(() => {
      if (!continuation) return undefined;
      const continued = new Set(continuation.continuedIds);
      return new Set(continuation.seatedIds.filter((id) => !continued.has(id)));
   }, [continuation]);

   const sharedModals = (
      <>
         <HostLeaveModal
            code={initial.code}
            open={hostLeaveCandidates !== null}
            candidates={hostLeaveCandidates ?? []}
            onlineIds={onlineIds}
            onClose={() => {
               setHostLeaveCandidates(null);
               setHostLeaveDestination(null);
            }}
            onLeft={() => {
               navigatingOutRef.current = true;
               const dest = hostLeaveDestination;
               setHostLeaveCandidates(null);
               setHostLeaveDestination(null);
               router.push(dest ?? '/play/lobby');
            }}
            onSubmittingChange={(submitting) => {
               // Same race-protection as confirmLeave — flip the flag the
               // moment passTheWheel fires, so the engine broadcast that
               // removes us from state.players can't surface the plank.
               if (submitting) navigatingOutRef.current = true;
               else navigatingOutRef.current = false;
            }}
         />
         <LeaveConfirmModal
            open={leaveConfirm !== null}
            kind={leaveConfirm?.kind ?? 'jump'}
            submitting={leaveConfirm?.submitting ?? false}
            onConfirm={confirmLeave}
            onCancel={cancelLeave}
         />
         <PirateModal
            open={plankedReason === 'hesitated'}
            dismissible={false}
            title='Forced to walk the plank'
         >
            <div className='flex flex-col items-center gap-3 text-center'>
               <span className='text-5xl' aria-hidden>
                  ☠️
               </span>
               <p className='text-sm text-[color:var(--color-cream-200)]/85'>
                  Ye hesitated too long! The captain&apos;s patience ran out and the crew shoved
                  ye into the brine.
               </p>
               <PirateButton
                  variant='primary'
                  size='lg'
                  fullWidth
                  loading={leaving}
                  onClick={goToLobby}
               >
                  Return to docks
               </PirateButton>
            </div>
         </PirateModal>
         <PirateModal
            open={plankedReason === 'kicked'}
            dismissible={false}
            title='Walked the plank'
         >
            <div className='flex flex-col items-center gap-3 text-center'>
               <span className='text-5xl' aria-hidden>
                  🚫
               </span>
               <p className='text-sm text-[color:var(--color-cream-200)]/85'>
                  The captain&apos;s booted ye from the crew. Find another ship.
               </p>
               <PirateButton
                  variant='primary'
                  size='lg'
                  fullWidth
                  loading={leaving}
                  onClick={goToLobby}
               >
                  Return to docks
               </PirateButton>
            </div>
         </PirateModal>
      </>
   );

   if (state.status === 'lobby') {
      return (
         <>
            {globalToast}
            <KnockInbox knocks={isHost ? knocks : []} onRemove={removeKnock} />
            <Lobby
               state={state}
               userId={userId}
               code={initial.code}
               hostId={hostId}
               realtimeStatus={status}
               onlineIds={onlineIds}
               isSpectator={isSpectator}
               isPublic={isPublic}
               onLeave={goToLobby}
               onLeaveRoom={handleLeaveRoom}
               navLeaving={leaving}
               onLeaveAsHost={handleLeaveHost}
               readyIds={readyIds}
               boardingUntil={boardingUntil}
               onBoardingUntil={setBoardingUntil}
            />
            {sharedModals}
         </>
      );
   }

   if (state.status === 'complete' && iHaveContinued) {
      return (
         <>
            {globalToast}
            <KnockInbox knocks={isHost ? knocks : []} onRemove={removeKnock} />
            <Lobby
               state={state}
               userId={userId}
               code={initial.code}
               hostId={hostId}
               realtimeStatus={status}
               onlineIds={onlineIds}
               isSpectator={isSpectator}
               isPublic={isPublic}
               onLeave={goToLobby}
               onLeaveRoom={handleLeaveRoom}
               navLeaving={leaving}
               onLeaveAsHost={handleLeaveHost}
               continuationDeadline={continuation?.deadlineAt}
               pendingIds={pendingIds}
               seatedIds={seatedIdSet}
            />
            {sharedModals}
         </>
      );
   }

   return (
      <>
         {globalToast}
         {settingSail && <SailOverlay />}
         <KnockInbox knocks={isHost ? knocks : []} onRemove={removeKnock} />
         <Play
            state={state}
            userId={userId}
            code={initial.code}
            hostId={hostId}
            realtimeStatus={status}
            applyOptimistic={applyOptimistic}
            onlineIds={onlineIds}
            turnDeadline={turnDeadline}
            isSpectator={isSpectator}
            onLeave={goToLobby}
               navLeaving={leaving}
            continuationDeadline={continuation?.deadlineAt ?? null}
            onContinue={handleContinue}
            onJumpShip={handleJumpShip}
            achieverIds={achieverIds}
            yourUnlocks={myUnlocks}
         />
         {sharedModals}
      </>
   );
}

function ContinueButton({
   deadlineAt,
   onContinue,
}: {
   deadlineAt: string | null;
   onContinue: () => void | Promise<void>;
}) {
   const [secs, setSecs] = useState(() => deriveSecs(deadlineAt));
   const [submitting, setSubmitting] = useState(false);
   useEffect(() => {
      if (!deadlineAt) return;
      const id = setInterval(() => setSecs(deriveSecs(deadlineAt)), 500);
      return () => clearInterval(id);
   }, [deadlineAt]);
   const display = formatMSS(secs);
   const click = async () => {
      setSubmitting(true);
      await onContinue();
   };
   return (
      <PirateButton
         variant='treasure'
         size='md'
         fullWidth
         onClick={click}
         loading={submitting}
         disabled={secs <= 0}
      >
         <span className='inline-flex items-center gap-2'>
            Continue
            <span className='font-mono font-bold tabular-nums inline-block w-[2ch] text-right'>
               {display}
            </span>
         </span>
      </PirateButton>
   );
}

function deriveSecs(deadlineAt: string | null): number {
   if (!deadlineAt) return 0;
   return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000));
}

function formatMSS(secs: number): string {
   // Show plain seconds — the window is short enough to never need minutes.
   // Pad to 2 chars so layout doesn't reflow as the number ticks down.
   return secs.toString().padStart(2, '0');
}

function ContinuationWaitingButton({ deadlineAt }: { deadlineAt: string }) {
   const [secs, setSecs] = useState(() => deriveSecs(deadlineAt));
   useEffect(() => {
      const id = setInterval(() => setSecs(deriveSecs(deadlineAt)), 500);
      return () => clearInterval(id);
   }, [deadlineAt]);
   const display = formatMSS(secs);
   return (
      <PirateButton variant='secondary' size='lg' fullWidth disabled>
         <span className='inline-flex items-center gap-2'>
            Waitin&apos; for crew
            <span className='font-mono font-bold tabular-nums inline-block w-[2ch] text-right'>
               {display}
            </span>
         </span>
      </PirateButton>
   );
}

function BoardingCountdown({
   deadlineMs,
   onElapsed,
}: {
   deadlineMs: number;
   onElapsed: () => void;
}) {
   const [secs, setSecs] = useState(() => Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
   useEffect(() => {
      const id = setInterval(() => {
         const s = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
         setSecs(s);
         if (s <= 0) {
            clearInterval(id);
            onElapsed();
         }
      }, 250);
      return () => clearInterval(id);
   }, [deadlineMs, onElapsed]);
   return (
      <span className='font-mono font-bold tabular-nums text-[color:var(--color-gold-300)]'>{secs}s</span>
   );
}

function SailOverlay() {
   return (
      <div className='fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[color:var(--color-abyss-900)]/90 backdrop-blur-sm'>
         <span className='text-6xl' aria-hidden>
            ⛵
         </span>
         <p className='wordmark-gold pirate-display text-4xl'>Settin&apos; sail!</p>
         <p className='animate-pulse text-sm text-[color:var(--color-cream-200)]/70'>
            All hands aboard — hoistin&apos; the anchor…
         </p>
      </div>
   );
}

function optimisticBank(prev: PublicGameState, actorId: string): PublicGameState {
   const sum = prev.currentStreak.reduce((acc, card) => acc + card.value, 0);
   const players = prev.players.map((p) => (p.id === actorId ? { ...p, coins: p.coins + sum } : p));
   const turnIndex = players.length === 0 ? 0 : (prev.turnIndex + 1) % players.length;
   return {
      ...prev,
      players,
      currentStreak: [],
      currentCard: null,
      turnIndex,
   };
}

function optimisticDrawStart(prev: PublicGameState): PublicGameState {
   return {
      ...prev,
      deckCount: Math.max(0, prev.deckCount - 1),
   };
}

function Lobby({
   state,
   userId,
   code,
   hostId,
   realtimeStatus,
   onlineIds,
   isSpectator,
   isPublic,
   onLeave,
   onLeaveRoom,
   navLeaving,
   onLeaveAsHost,
   continuationDeadline,
   pendingIds,
   seatedIds,
   readyIds,
   boardingUntil = null,
   onBoardingUntil,
}: {
   state: RoomState;
   userId: string;
   code: string;
   hostId: string;
   realtimeStatus: RealtimeStatus;
   onlineIds: ReadonlySet<string>;
   isSpectator: boolean;
   isPublic: boolean;
   onLeave: () => void;
   onLeaveRoom: () => void;
   navLeaving: boolean;
   onLeaveAsHost: () => void;
   continuationDeadline?: string;
   pendingIds?: ReadonlySet<string>;
   seatedIds?: ReadonlySet<string>;
   readyIds?: ReadonlySet<string>;
   boardingUntil?: number | null;
   onBoardingUntil?: (until: number | null) => void;
}) {
   const isHost = userId === hostId;
   const [error, setError] = useState<string | null>(null);
   const [starting, setStarting] = useState(false);
   const [readyPending, setReadyPending] = useState(false);
   const [copied, setCopied] = useState(false);
   const [leaving, setLeaving] = useState(false);
   const [togglingVis, setTogglingVis] = useState(false);
   const [publicState, setPublicState] = useState(isPublic);
   useEffect(() => setPublicState(isPublic), [isPublic]);
   const toggleVisibility = async () => {
      setTogglingVis(true);
      const next = !publicState;
      setPublicState(next);
      const res = await setRoomVisibility({ code, isPublic: next });
      setTogglingVis(false);
      if (!res.ok) {
         setPublicState(!next);
         setError(res.error);
      }
   };
   // Visible player list filters anyone who isn't currently connected
   // (after the grace window) so the lobby reflects reality. During the
   // continuation window we additionally hide jumpers (engine snapshot
   // stays frozen for the VictoryModal but the lobby view shouldn't show
   // people who already bailed).
   const visiblePlayers = state.players.filter(
      (p) =>
         (seatedIds ? seatedIds.has(p.id) : true) &&
         (onlineIds.has(p.id) || p.id === userId),
   );
   const canStart = isHost && visiblePlayers.length >= MIN_PLAYERS;

   // Ready-up only applies to the fresh pre-game lobby, not the post-game
   // continuation re-lobby (which has its own Continue flow).
   const readyUpPhase = !continuationDeadline;
   const crew = visiblePlayers.filter((p) => p.id !== hostId);
   const readyCrew = crew.filter((p) => readyIds?.has(p.id));
   const allCrewReady = crew.length > 0 && readyCrew.length === crew.length;
   const iAmReady = readyIds?.has(userId) ?? false;
   const boardingActive = readyUpPhase && boardingUntil !== null;
   const clearBoarding = useCallback(() => onBoardingUntil?.(null), [onBoardingUntil]);

   const handleLeaveSpectator = async () => {
      setLeaving(true);
      await leaveSpectator({ code });
      onLeave();
   };

   const toggleReady = async () => {
      setError(null);
      setReadyPending(true);
      const result = await setReady({ code, ready: !iAmReady });
      setReadyPending(false);
      if (!result.ok) setError(result.error);
   };

   // Host start. All crew ready → sail immediately; otherwise open the boarding
   // countdown so stragglers get a chance before they're dropped.
   const onStartPressed = async () => {
      setError(null);
      if (allCrewReady) {
         setStarting(true);
         const result = await startOnlineGame({ code });
         setStarting(false);
         if (!result.ok) setError(result.error);
         return;
      }
      const result = await beginBoarding({ code });
      if (result.ok && result.deadline) onBoardingUntil?.(Date.parse(result.deadline));
      else if (!result.ok) setError(result.error);
   };

   // Host drives the boarding finalize: if everyone readies up mid-countdown,
   // sail now (no drops); at the deadline, drop the unready and sail. The
   // server re-validates both, and clears boarding either way.
   useEffect(() => {
      if (!isHost || !readyUpPhase || boardingUntil === null) return;
      if (allCrewReady) {
         void startOnlineGame({ code }).then((r) => {
            if (!r.ok) setError(r.error);
         });
         onBoardingUntil?.(null);
         return;
      }
      const delay = Math.max(0, boardingUntil - Date.now());
      const handle = setTimeout(() => {
         void startGameDroppingUnready({ code }).then((r) => {
            if (!r.ok) setError(r.error);
         });
         onBoardingUntil?.(null);
      }, delay);
      return () => clearTimeout(handle);
      // onBoardingUntil is stable (a setState); excluded to avoid needless re-runs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isHost, readyUpPhase, boardingUntil, allCrewReady, code]);

   const share = async () => {
      const url = typeof window !== 'undefined' ? `${window.location.origin}/play/${code}` : '';
      const announceCopied = () => {
         setCopied(true);
         setTimeout(() => setCopied(false), 1800);
      };
      // Prefer the modern clipboard API (HTTPS / localhost). Fall back to
      // the legacy execCommand path so plain-HTTP LAN testing still works.
      try {
         if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(url);
            announceCopied();
            return;
         }
      } catch {
         // Permission denied or transient — fall through to legacy path.
      }
      try {
         const ta = document.createElement('textarea');
         ta.value = url;
         ta.setAttribute('readonly', '');
         ta.style.position = 'fixed';
         ta.style.opacity = '0';
         document.body.appendChild(ta);
         ta.select();
         const ok = document.execCommand('copy');
         document.body.removeChild(ta);
         if (ok) announceCopied();
      } catch {
         // Last resort: nothing we can do silently. Could prompt() the URL
         // but that's uglier than just shrugging.
      }
   };

   return (
      <main className='flex min-h-0 flex-1 flex-col gap-3 px-5 pt-2 sm:gap-4'>
         <header className='flex flex-col gap-1 text-center'>
            <div className='flex justify-center'>
               <ConnectionDot status={realtimeStatus} />
            </div>
            <h1 className='wordmark-gold pirate-display text-3xl sm:text-5xl'>Awaiting Crew</h1>
            <p className='text-sm text-[color:var(--color-cream-200)]/75'>
               {visiblePlayers.length}/{MAX_PLAYERS} aboard · need at least {MIN_PLAYERS}
            </p>
         </header>

         <PiratePanel variant='deep' className='relative flex flex-col items-center gap-2 overflow-hidden p-3'>
            <div
               className='pointer-events-none absolute inset-0 opacity-60'
               style={{
                  background:
                     'radial-gradient(ellipse 70% 60% at 50% 0%, rgb(94 234 212 / 0.12) 0%, transparent 65%)',
               }}
               aria-hidden
            />
            <span className='text-xs uppercase tracking-[0.3em] text-[color:var(--color-teal-400)]'>Room code</span>
            <span
               data-testid='room-code'
               className='wordmark-gold-mono text-5xl tracking-[0.45em] sm:text-7xl [text-indent:0.45em]'
            >
               {code}
            </span>
            <PirateButton variant='secondary' size='sm' fullWidth onClick={share}>
               {copied ? 'Copied!' : 'Copy invite link'}
            </PirateButton>
            {isHost && (
               <button
                  type='button'
                  onClick={toggleVisibility}
                  disabled={togglingVis}
                  className='mt-1 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-surface-border)] bg-[color:var(--color-abyss-900)]/60 px-3 py-1 text-xs text-[color:var(--color-cream-200)]/85 hover:border-[color:var(--color-gold-500)]/60 disabled:opacity-60'
                  title={
                     publicState
                        ? "Open voyage — anyone can board. Tap to make private."
                        : 'Sealed hold — captain approves boarders. Tap to make public.'
                  }
               >
                  <span
                     className={
                        publicState
                           ? 'h-2 w-2 rounded-full bg-[color:var(--color-teal-400)]'
                           : 'h-2 w-2 rounded-full bg-[color:var(--color-coral-500)]'
                     }
                     aria-hidden
                  />
                  {publicState ? 'Open voyage' : 'Sealed hold'}
                  <span className='text-[color:var(--color-cream-200)]/55'>· tap to flip</span>
               </button>
            )}
         </PiratePanel>

         <div className='scrollbar-none min-h-0 flex-1 overflow-y-auto'>
            <CrewGrid
               players={visiblePlayers}
               capacity={MAX_PLAYERS}
               hostId={hostId}
               youId={userId}
               pendingIds={pendingIds}
               readyIds={readyUpPhase ? readyIds : undefined}
               renderRowAction={
                  continuationDeadline
                     ? undefined
                     : (player) => {
                          if (player.id === userId) {
                             return <LobbyRenameButton currentName={player.name} />;
                          }
                          if (isHost && player.id !== hostId) {
                             return (
                                <CaptainMenu
                                   code={code}
                                   targetUserId={player.id}
                                   targetName={player.name}
                                   roomStatus='lobby'
                                />
                             );
                          }
                          return null;
                       }
               }
            />
         </div>

         {state.spectators.length > 0 && (
            <SpectatorRow spectators={state.spectators} youId={userId} />
         )}

         {error && <p className='text-center text-sm text-[color:var(--color-coral-500)]'>{error}</p>}

         <div className='mt-auto flex flex-col gap-2 pt-2 safe-bottom'>
            {isSpectator ? (
               <div className='flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-700)]/45 px-3 py-2 text-sm'>
                  <span className='text-[color:var(--color-cream-200)]/75'>
                     Spectating — seat opens next round.
                  </span>
                  <PirateButton
                     variant='ghost'
                     size='sm'
                     onClick={handleLeaveSpectator}
                     loading={leaving || navLeaving}
                  >
                     Leave
                  </PirateButton>
               </div>
            ) : continuationDeadline ? (
               <ContinuationWaitingButton deadlineAt={continuationDeadline} />
            ) : boardingActive ? (
               <div className='flex flex-col gap-2'>
                  <p className='text-center text-sm text-[color:var(--color-cream-200)]/85'>
                     Settin&apos; sail in{' '}
                     <BoardingCountdown deadlineMs={boardingUntil!} onElapsed={clearBoarding} /> ·{' '}
                     {readyCrew.length}/{crew.length} crew ready
                  </p>
                  {!isHost && !iAmReady ? (
                     <PirateButton
                        variant='primary'
                        size='lg'
                        fullWidth
                        onClick={toggleReady}
                        loading={readyPending}
                     >
                        Ready up — last call!
                     </PirateButton>
                  ) : (
                     <PirateButton variant='secondary' size='lg' fullWidth disabled>
                        {isHost ? 'Waitin’ for crew…' : 'Ready ✓'}
                     </PirateButton>
                  )}
               </div>
            ) : isHost ? (
               <div className='flex flex-col gap-2'>
                  <PirateButton
                     variant='primary'
                     size='lg'
                     fullWidth
                     onClick={onStartPressed}
                     disabled={!canStart}
                     loading={starting}
                  >
                     {allCrewReady ? 'Set Sail!' : 'Hoist the Colors!'}
                  </PirateButton>
                  {!canStart ? (
                     <p className='text-center text-xs text-[color:var(--color-cream-200)]/60'>
                        Need at least {MIN_PLAYERS} crewmates.
                     </p>
                  ) : !allCrewReady ? (
                     <p className='text-center text-xs text-[color:var(--color-cream-200)]/60'>
                        {readyCrew.length}/{crew.length} crew ready — sailing gives the rest{' '}
                        {Math.round(BOARDING_COUNTDOWN_MS / 1000)}s to ready up.
                     </p>
                  ) : null}
                  <PirateButton variant='ghost' size='sm' fullWidth onClick={onLeaveAsHost}>
                     Abandon ship
                  </PirateButton>
               </div>
            ) : (
               <div className='flex flex-col gap-2'>
                  <PirateButton
                     variant={iAmReady ? 'secondary' : 'primary'}
                     size='lg'
                     fullWidth
                     onClick={toggleReady}
                     loading={readyPending}
                  >
                     {iAmReady ? 'Ready ✓ — stand down' : 'Ready up!'}
                  </PirateButton>
                  <p className='text-center text-xs text-[color:var(--color-cream-200)]/55'>
                     {iAmReady
                        ? 'Waitin’ for the captain to set sail…'
                        : 'Let the captain know yer aboard.'}
                  </p>
                  <PirateButton
                     variant='ghost'
                     size='sm'
                     fullWidth
                     onClick={onLeaveRoom}
                     loading={leaving || navLeaving}
                  >
                     Jump Ship
                  </PirateButton>
               </div>
            )}
         </div>
         <RenameNudge isSeated={state.players.some((p) => p.id === userId)} />
      </main>
   );
}

function SpectatorRow({
   spectators,
   youId,
}: {
   spectators: ReadonlyArray<RoomSpectatorView>;
   youId: string;
}) {
   return (
      <div className='-mx-5 px-5'>
         <div className='flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[color:var(--color-cream-200)]/55'>
            <span>Spectators</span>
            <span className='h-px flex-1 bg-[color:var(--color-surface-border)]' />
         </div>
         <div className='scrollbar-none mt-1 flex gap-1.5 overflow-x-auto py-1'>
            {spectators.map((sp) => (
               <span
                  key={sp.id}
                  className='inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[color:var(--color-surface-border)] bg-[color:var(--color-abyss-900)]/40 px-2.5 py-1 text-xs text-[color:var(--color-cream-200)]/80'
               >
                  {sp.name}
                  {sp.id === youId && (
                     <span className='text-[10px] text-[color:var(--color-cream-200)]/55'>you</span>
                  )}
               </span>
            ))}
         </div>
      </div>
   );
}

function Play({
   state,
   userId,
   code,
   hostId,
   realtimeStatus,
   applyOptimistic,
   onlineIds,
   turnDeadline,
   isSpectator,
   onLeave,
   navLeaving,
   continuationDeadline,
   onContinue,
   onJumpShip,
   achieverIds,
   yourUnlocks,
}: {
   state: RoomState;
   userId: string;
   code: string;
   hostId: string;
   realtimeStatus: RealtimeStatus;
   applyOptimistic: (mutator: (prev: PublicGameState) => PublicGameState) => void;
   onlineIds: ReadonlySet<string>;
   turnDeadline: string | null;
   isSpectator: boolean;
   onLeave: () => void;
   navLeaving: boolean;
   continuationDeadline: string | null;
   onContinue: () => void | Promise<void>;
   onJumpShip: () => void | Promise<void>;
   achieverIds: ReadonlySet<string>;
   yourUnlocks: readonly string[];
}) {
   const [pending, setPending] = useState<null | 'draw' | 'bank' | 'end'>(null);
   const [error, setError] = useState<string | null>(null);
   const [drawingCard, setDrawingCard] = useState(false);
   const [leavingSpectate, setLeavingSpectate] = useState(false);
   const { toastElement, showToast } = useGameToast();

   const isHost = userId === hostId;
   const handleLeaveSpectator = async () => {
      setLeavingSpectate(true);
      await leaveSpectator({ code });
      onLeave();
   };

   // Clear the draw-pending flag whenever the broadcast lands with a new card.
   useEffect(() => {
      setDrawingCard(false);
   }, [state.currentCard, state.turnIndex, state.deckCount]);

   const currentPlayer = state.players[state.turnIndex];
   const isCurrent = currentPlayer?.id === userId;
   const isPirate = state.currentCard?.kind === 'pirate';
   const isComplete = state.status === 'complete';
   // Who the helm passes to once this turn ends — mirrors the engine's
   // advanceTurn (skip past absent seats). Used to name the next player during
   // the pirate hand-off beat.
   const nextHolder = (() => {
      const n = state.players.length;
      if (n === 0) return null;
      let i = (state.turnIndex + 1) % n;
      for (let k = 0; k < n; k++) {
         const candidate = state.players[i];
         if (candidate && !state.absentIds.includes(candidate.id)) return candidate;
         i = (i + 1) % n;
      }
      return state.players[(state.turnIndex + 1) % n] ?? null;
   })();
   const deadlineMs = turnDeadline ? Date.parse(turnDeadline) : null;
   const clockRemaining = useCountdown(deadlineMs);
   // The "helm passes to X" hand-off beat: a revealed pirate (short deadline,
   // no decision) OR the shot clock having just run out. Both pause briefly on
   // the hand-off line before the turn advances, so they feel the same.
   const handingOff =
      !isComplete &&
      state.status === 'active' &&
      (isPirate || (deadlineMs !== null && clockRemaining <= 0));
   const winner = state.winnerId ? (state.players.find((p) => p.id === state.winnerId) ?? null) : null;
   const ranked = isComplete ? [...state.players].sort((a, b) => b.coins - a.coins) : [];
   const streakSum = state.currentStreak.reduce((sum, c) => sum + c.value, 0);
   const canDraw = state.status === 'active' && isCurrent && !isPirate && state.deckCount > 0;
   const canBank = state.status === 'active' && isCurrent && !isPirate && state.currentStreak.length > 0;

   const snap = useMemo<JuiceSnapshot>(
      () => ({
         status: state.status,
         turnIndex: state.turnIndex,
         currentCardKind: state.currentCard?.kind ?? null,
         streakLength: state.currentStreak.length,
         players: state.players.map((p) => ({ id: p.id, coins: p.coins })),
         isMyTurn: isCurrent,
      }),
      [state.status, state.turnIndex, state.currentCard, state.currentStreak, state.players, isCurrent],
   );
   const { bankFx, clearBankFx, shakeKey } = useGameJuice(snap);

   const announceSnap = useMemo<AnnounceSnapshot>(
      () => ({
         status: state.status,
         turnIndex: state.turnIndex,
         currentCardKind: state.currentCard?.kind ?? null,
         currentName: currentPlayer?.name ?? null,
         winnerName: winner?.name ?? null,
         isMyTurn: isCurrent,
      }),
      [state.status, state.turnIndex, state.currentCard, currentPlayer?.name, winner?.name, isCurrent],
   );
   const { announcer } = useGameAnnouncer(announceSnap);

   const [shaking, setShaking] = useState(false);
   useEffect(() => {
      if (shakeKey > 0) setShaking(true);
   }, [shakeKey]);

   // Auto-forfeit win: if everyone else has dropped off the presence
   // channel and I'm the only one left in an active game, declare myself
   // the winner so the game ends cleanly. Presence already includes the
   // 15s grace window, so this only fires after the timeout completes.
   const seatedOnline = state.players.filter((p) => onlineIds.has(p.id));
   // Players actually able to play: online AND not flagged absent. Counting
   // absent (explicitly-left) seats here means a forfeit fires the instant the
   // other player leaves, instead of waiting out their presence grace.
   const seatedActive = state.players.filter(
      (p) => onlineIds.has(p.id) && !state.absentIds.includes(p.id),
   );
   const aloneInActiveGame =
      !isSpectator &&
      state.status === 'active' &&
      !isComplete &&
      !state.absentIds.includes(userId) &&
      onlineIds.has(userId) &&
      seatedActive.length === 1 &&
      seatedActive[0]?.id === userId &&
      state.players.length > 1;
   useEffect(() => {
      if (!aloneInActiveGame) return;
      let cancelled = false;
      void endGameByForfeit({ code }).catch((err) => {
         if (!cancelled) console.error('endGameByForfeit failed', err);
      });
      return () => {
         cancelled = true;
      };
   }, [aloneInActiveGame, code]);

   // Skip the helm forward when the current turn player has dropped off
   // presence and the rest of the table is still waiting. Only one client
   // dispatches per round (the lowest-seat seated player who is online)
   // and the server is idempotent on stale skip attempts, so the race is
   // harmless.
   const turnHolderId = currentPlayer?.id ?? null;
   const turnHolderOffline =
      !isSpectator &&
      state.status === 'active' &&
      !isComplete &&
      turnHolderId !== null &&
      turnHolderId !== userId &&
      !onlineIds.has(turnHolderId) &&
      seatedOnline.length >= 2;
   const skipLeaderId = seatedOnline[0]?.id ?? null;
   const iAmSkipLeader = skipLeaderId === userId;
   useEffect(() => {
      if (!turnHolderOffline || !iAmSkipLeader || !turnHolderId) return;
      const handle = setTimeout(() => {
         void skipAbsentTurn({ code, expectedTurnPlayerId: turnHolderId }).catch((err) => {
            console.error('skipAbsentTurn failed', err);
         });
      }, 1500);
      return () => clearTimeout(handle);
   }, [turnHolderOffline, iAmSkipLeader, turnHolderId, code]);

   // Shot clock: when the helm-holder is online but idle, their turn
   // auto-resolves at the deadline so the table isn't stuck waiting. A single
   // designated firer — the lowest-seat online player who is NOT the holder,
   // so an away-but-connected holder still gets timed out — schedules the
   // call. The server enforces the deadline (rejecting an early call) and
   // dedupes racing clients, so this is best-effort. An OFFLINE holder is
   // handled by the faster skipAbsentTurn path above instead.
   const timeoutFirerId =
      (seatedOnline.find((pl) => pl.id !== turnHolderId) ?? seatedOnline[0])?.id ?? null;
   const clockHolderId =
      !isSpectator &&
      state.status === 'active' &&
      !isComplete &&
      turnHolderId !== null &&
      onlineIds.has(turnHolderId) &&
      timeoutFirerId === userId
         ? turnHolderId
         : null;
   useEffect(() => {
      if (clockHolderId === null || deadlineMs === null) return;
      // A pirate's deadline IS its hand-off beat, so advance right after it.
      // A regular timeout shows the "helm passes to X" beat AFTER the clock
      // runs out, so hold the advance one beat longer so everyone sees it.
      // The 300ms cushion keeps us safely past the server's deadline guard.
      const beatMs = isPirate ? 0 : PIRATE_PASS_MS;
      const delay = Math.max(0, deadlineMs - Date.now()) + beatMs + 300;
      const handle = setTimeout(() => {
         void timeoutTurn({ code, expectedTurnPlayerId: clockHolderId }).catch((err) => {
            console.error('timeoutTurn failed', err);
         });
      }, delay);
      return () => clearTimeout(handle);
   }, [clockHolderId, deadlineMs, isPirate, code]);

   // I just reconnected after being skipped — clear my absent flag so
   // the table stops jumping over my seat.
   const iAmAbsent = !isSpectator && state.absentIds.includes(userId);
   useEffect(() => {
      if (!iAmAbsent || state.status !== 'active') return;
      void markPresentOnline({ code }).catch((err) => {
         console.error('markPresentOnline failed', err);
      });
   }, [iAmAbsent, state.status, code]);

   // Pirate reveal — toast for everyone watching, once per reveal.
   useEffect(() => {
      if (isPirate && !isComplete) showToast('Robbed!', 'blood');
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isPirate]);

   const wrap = async (
      label: 'draw' | 'bank' | 'end',
      fn: () => Promise<{ ok: boolean; error?: string }>,
      optimistic?: () => void,
   ) => {
      setPending(label);
      setError(null);
      optimistic?.();
      const result = await fn();
      setPending(null);
      if (!result.ok) {
         setError(result.error ?? 'Failed');
         setDrawingCard(false);
      }
   };

   const handleDraw = () => {
      setDrawingCard(true);
      void wrap(
         'draw',
         () => drawOnline(code),
         () => applyOptimistic(optimisticDrawStart),
      );
   };

   const handleBank = () => {
      showToast(`Banked ${streakSum}!`, 'gold');
      void wrap(
         'bank',
         () => bankOnline(code),
         () => applyOptimistic((prev) => optimisticBank(prev, userId)),
      );
   };

   return (
      <main
         className={cn('flex min-h-0 flex-1 flex-col gap-2 px-4 pt-2 sm:gap-3', shaking && 'animate-bust-shake')}
         onAnimationEnd={(e) => {
            if (e.animationName === 'bust-shake') setShaking(false);
         }}
      >
         {announcer}
         {isPirate && !isComplete && <BustVignette />}
         {toastElement}
         {bankFx && <ChestBurst key={bankFx.key} amount={bankFx.amount} onDone={clearBankFx} />}

         <ScoreRibbon
            players={state.players.filter((p) => onlineIds.has(p.id) || p.id === userId)}
            currentPlayerId={currentPlayer?.id}
            youId={userId}
            spectators={state.spectators}
         />

         <div className='relative z-10 text-center'>
            <span className='chip-pirate min-h-6 px-2.5 text-[10px]'>
               <ConnectionDot status={realtimeStatus} compact />
               <span className='font-mono font-bold tracking-widest text-[color:var(--color-gold-300)]'>{code}</span>
            </span>
            <StatusBanner
               isComplete={isComplete}
               isPirate={isPirate}
               currentName={currentPlayer?.name}
               isCurrent={isCurrent}
               streakSum={streakSum}
            />
         </div>

         <div className='relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-2'>
            <div className='relative flex min-h-0 w-full flex-1 justify-center'>
               <PirateCard card={drawingCard ? null : state.currentCard} />
               {drawingCard && (
                  <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
                     <div className='pirate-display animate-pulse rounded-full border border-[color:var(--color-gold-500)]/50 bg-black/70 px-4 py-1.5 text-sm text-[color:var(--color-gold-300)]'>
                        Plunderin&apos;…
                     </div>
                  </div>
               )}
            </div>
            <StreakStrip streak={state.currentStreak} />
         </div>

         {error && <p className='text-center text-sm text-[color:var(--color-coral-500)]'>{error}</p>}

         <div className='z-20 mt-auto flex flex-col gap-2 pt-2 safe-bottom'>
            {/* Fuse only while there's a live decision — during a hand-off
                (pirate or expired clock) we show the hand-off line instead. */}
            {!isComplete && !handingOff && deadlineMs !== null && (
               <TurnClock
                  deadlineMs={deadlineMs}
                  totalMs={TURN_CLOCK_MS}
                  mine={isCurrent && !isSpectator}
               />
            )}
            {isComplete ? null : isSpectator ? (
               <div className='flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-700)]/45 px-3 py-2 text-sm'>
                  <span className='text-[color:var(--color-cream-200)]/75'>Spectating the voyage</span>
                  <PirateButton
                     variant='ghost'
                     size='sm'
                     onClick={handleLeaveSpectator}
                     loading={leavingSpectate || navLeaving}
                  >
                     Leave room
                  </PirateButton>
               </div>
            ) : handingOff ? (
               // Pirate revealed or the shot clock ran out — no decision left.
               // Name who's up next instead of a timer, then auto-advance.
               <p className='animate-pulse text-center text-sm font-semibold text-[color:var(--color-gold-300)]'>
                  The helm passes to {nextHolder?.name ?? 'the next pirate'}…
               </p>
            ) : !isCurrent ? (
               <p className='animate-pulse text-center text-sm text-[color:var(--color-cream-200)]/70'>
                  Waiting on {currentPlayer?.name ?? 'the helm'}…
               </p>
            ) : (
               <div className='flex gap-3'>
                  <PirateButton
                     variant='primary'
                     size='lg'
                     fullWidth
                     onClick={handleDraw}
                     loading={pending === 'draw'}
                     disabled={!canDraw || pending !== null}
                  >
                     Plunder
                  </PirateButton>
                  <PirateButton
                     variant='secondary'
                     size='lg'
                     fullWidth
                     onClick={handleBank}
                     loading={pending === 'bank'}
                     disabled={!canBank || pending !== null}
                  >
                     Bury It
                  </PirateButton>
               </div>
            )}
         </div>

         <VictoryModal
            open={isComplete}
            winner={winner}
            ranked={ranked}
            youId={userId}
            achieverIds={achieverIds}
            yourUnlocks={yourUnlocks}
            actions={
               isSpectator ? (
                  <>
                     <PirateButton
                        variant='tertiary'
                        size='md'
                        fullWidth
                        onClick={handleLeaveSpectator}
                        loading={leavingSpectate || navLeaving}
                     >
                        To port
                     </PirateButton>
                     <span className='inline-flex w-full items-center justify-center rounded-xl border border-dashed border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-700)]/45 px-4 py-3 text-center text-sm text-[color:var(--color-cream-200)]/70'>
                        Stay aboard — ye&apos;ll be seated next round.
                     </span>
                  </>
               ) : (
                  <>
                     <PirateButton
                        variant='tertiary'
                        size='md'
                        fullWidth
                        onClick={onJumpShip}
                     >
                        Jump ship
                     </PirateButton>
                     <ContinueButton
                        deadlineAt={continuationDeadline}
                        onContinue={onContinue}
                     />
                  </>
               )
            }
         />
      </main>
   );
}

function StatusBanner({
   isComplete,
   isPirate,
   currentName,
   isCurrent,
   streakSum,
}: {
   isComplete: boolean;
   isPirate: boolean;
   currentName: string | undefined;
   isCurrent: boolean;
   streakSum: number;
}) {
   let title = isCurrent ? `Yer turn, ${currentName ?? 'sailor'}!` : currentName ? `${currentName} is at the helm` : '';
   let subtitle = `Booty in hand: ${streakSum}`;
   let titleClass = 'text-[color:var(--color-gold-300)]';
   if (isComplete) {
      title = 'The deck is empty.';
      subtitle = 'All loot has been claimed.';
   } else if (isPirate) {
      title = 'Pirate!';
      subtitle = isCurrent ? 'Yer streak be sunk. Pass the helm.' : `${currentName ?? 'They'} drew a pirate.`;
      titleClass = 'text-[color:var(--color-coral-500)]';
   }
   return (
      <div className='min-h-[56px] text-center'>
         <h2 className={`pirate-display text-2xl sm:text-4xl ${titleClass}`}>{title}</h2>
         <p className='mt-0.5 text-sm text-[color:var(--color-cream-200)]/75'>{subtitle}</p>
      </div>
   );
}

function ConnectionDot({ status, compact }: { status: RealtimeStatus; compact?: boolean }) {
   const tone =
      status === 'connected'
         ? 'bg-[color:var(--color-teal-400)] shadow-[0_0_8px_rgb(94_234_212/0.7)]'
         : status === 'connecting' || status === 'reconnecting'
           ? 'bg-[color:var(--color-gold-400)] animate-pulse'
           : 'bg-[color:var(--color-coral-600)]';
   const label =
      status === 'connected'
         ? 'Live'
         : status === 'reconnecting'
           ? 'Reconnecting'
           : status === 'error'
             ? 'Offline'
             : 'Connecting';
   if (compact) {
      return <span className={cn('inline-block h-2 w-2 rounded-full', tone)} aria-label={label} />;
   }
   return (
      <span className='chip-pirate text-[10px] uppercase tracking-wider'>
         <span className={cn('h-2 w-2 rounded-full', tone)} aria-hidden />
         {label}
      </span>
   );
}
