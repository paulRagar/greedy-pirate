'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameRoom, type RealtimeStatus } from '@/client/realtime/useGameRoom';
import { useGameJuice, type JuiceSnapshot } from '@/client/hooks/useGameJuice';
import type { PublicGameState, RoomState } from '@/game/public';
import { bankOnline, drawOnline, endTurnOnline } from '@/server/actions/gameTurnActions';
import { startOnlineGame } from '@/server/actions/startOnlineGame';
import { endGameByForfeit, restartRoom } from '@/server/actions/restartRoom';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateCard } from '@/ui/pirate-card/PirateCard';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { BustVignette } from '@/ui/effects/BustVignette';
import { ChestBurst } from '@/ui/effects/ChestBurst';
import { CrewGrid } from '@/ui/game-room/CrewGrid';
import { ScoreRibbon } from '@/ui/game-room/ScoreRibbon';
import { StreakStrip } from '@/ui/game-room/StreakStrip';
import { VictoryModal } from '@/ui/game-room/VictoryModal';
import { useGameToast } from '@/ui/toast/PirateToast';
import { MAX_PLAYERS, MIN_PLAYERS } from '@/game/rules';
import { cn } from '@/lib/cn';

interface Props {
   gameId: string;
   userId: string;
   initial: RoomState;
}

export default function OnlineRoomClient({ gameId, userId, initial }: Props) {
   const router = useRouter();
   const {
      state: live,
      status,
      applyOptimistic,
      onlineIds,
   } = useGameRoom(gameId, initial.code, initial, {
      onResume: () => router.refresh(),
      userId,
   });
   const state: RoomState = { ...live, code: initial.code, hostId: initial.hostId };

   if (state.status === 'lobby') {
      return (
         <Lobby
            state={state}
            userId={userId}
            code={initial.code}
            hostId={initial.hostId}
            realtimeStatus={status}
            onlineIds={onlineIds}
         />
      );
   }
   return (
      <Play
         state={state}
         userId={userId}
         code={initial.code}
         hostId={initial.hostId}
         realtimeStatus={status}
         applyOptimistic={applyOptimistic}
         onlineIds={onlineIds}
         onLeave={() => router.push('/choose-game')}
      />
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

function optimisticEndTurn(prev: PublicGameState): PublicGameState {
   const turnIndex = prev.players.length === 0 ? 0 : (prev.turnIndex + 1) % prev.players.length;
   return {
      ...prev,
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
}: {
   state: RoomState;
   userId: string;
   code: string;
   hostId: string;
   realtimeStatus: RealtimeStatus;
   onlineIds: ReadonlySet<string>;
}) {
   const isHost = userId === hostId;
   const [error, setError] = useState<string | null>(null);
   const [starting, setStarting] = useState(false);
   const [copied, setCopied] = useState(false);
   // Visible player list filters anyone who isn't currently connected
   // (after the grace window) so the lobby reflects reality.
   const visiblePlayers = state.players.filter((p) => onlineIds.has(p.id) || p.id === userId);
   const canStart = isHost && visiblePlayers.length >= MIN_PLAYERS;

   const start = async () => {
      setError(null);
      setStarting(true);
      const result = await startOnlineGame({ code });
      setStarting(false);
      if (!result.ok) setError(result.error);
   };

   const share = async () => {
      const url = typeof window !== 'undefined' ? `${window.location.origin}/play/${code}` : '';
      try {
         if (navigator.share) {
            await navigator.share({ title: 'Greedy Pirate', text: `Join my room: ${code}`, url });
            return;
         }
      } catch {
         // user cancelled — fall through to clipboard
      }
      try {
         await navigator.clipboard.writeText(url);
         setCopied(true);
         setTimeout(() => setCopied(false), 1800);
      } catch {
         // clipboard blocked; ignore
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
            <span className='wordmark-gold pirate-display text-5xl tracking-[0.45em] sm:text-7xl [text-indent:0.45em]'>
               {code}
            </span>
            <PirateButton variant='secondary' size='sm' fullWidth onClick={share}>
               {copied ? 'Copied!' : 'Share invite'}
            </PirateButton>
         </PiratePanel>

         <div className='scrollbar-none min-h-0 flex-1 overflow-y-auto'>
            <CrewGrid players={visiblePlayers} capacity={MAX_PLAYERS} hostId={hostId} youId={userId} />
         </div>

         {error && <p className='text-center text-sm text-[color:var(--color-coral-500)]'>{error}</p>}

         <div className='mt-auto pt-2 safe-bottom'>
            {isHost ? (
               <>
                  <PirateButton variant='primary' size='lg' fullWidth onClick={start} disabled={!canStart || starting}>
                     {starting ? 'Setting sail…' : 'Hoist the Colors!'}
                  </PirateButton>
                  {!canStart && (
                     <p className='mt-2 text-center text-xs text-[color:var(--color-cream-200)]/60'>
                        Need at least {MIN_PLAYERS} crewmates.
                     </p>
                  )}
               </>
            ) : (
               <p className='animate-pulse text-center text-sm text-[color:var(--color-cream-200)]/60'>
                  Waiting for the captain to hoist the colors…
               </p>
            )}
         </div>
      </main>
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
   onLeave,
}: {
   state: RoomState;
   userId: string;
   code: string;
   hostId: string;
   realtimeStatus: RealtimeStatus;
   applyOptimistic: (mutator: (prev: PublicGameState) => PublicGameState) => void;
   onlineIds: ReadonlySet<string>;
   onLeave: () => void;
}) {
   const [pending, setPending] = useState<null | 'draw' | 'bank' | 'end'>(null);
   const [error, setError] = useState<string | null>(null);
   const [drawingCard, setDrawingCard] = useState(false);
   const [restarting, setRestarting] = useState(false);
   const { toastElement, showToast } = useGameToast();

   const isHost = userId === hostId;

   // Clear the draw-pending flag whenever the broadcast lands with a new card.
   useEffect(() => {
      setDrawingCard(false);
   }, [state.currentCard, state.turnIndex, state.deckCount]);

   const currentPlayer = state.players[state.turnIndex];
   const isCurrent = currentPlayer?.id === userId;
   const isPirate = state.currentCard?.kind === 'pirate';
   const isComplete = state.status === 'complete';
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

   const [shaking, setShaking] = useState(false);
   useEffect(() => {
      if (shakeKey > 0) setShaking(true);
   }, [shakeKey]);

   // Auto-forfeit win: if everyone else has dropped off the presence
   // channel and I'm the only one left in an active game, declare myself
   // the winner so the game ends cleanly. Presence already includes the
   // 15s grace window, so this only fires after the timeout completes.
   const seatedOnline = state.players.filter((p) => onlineIds.has(p.id));
   const aloneInActiveGame =
      state.status === 'active' &&
      onlineIds.has(userId) &&
      seatedOnline.length === 1 &&
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

   const handlePlayAgain = async () => {
      setRestarting(true);
      const res = await restartRoom({ code });
      setRestarting(false);
      if (!res.ok) setError(res.error);
   };

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

   const handleEndTurn = () => {
      void wrap(
         'end',
         () => endTurnOnline(code),
         () => applyOptimistic(optimisticEndTurn),
      );
   };

   return (
      <main
         className={cn('flex min-h-0 flex-1 flex-col gap-2 px-4 pt-2 sm:gap-3', shaking && 'animate-bust-shake')}
         onAnimationEnd={(e) => {
            if (e.animationName === 'bust-shake') setShaking(false);
         }}
      >
         {isPirate && !isComplete && <BustVignette />}
         {toastElement}
         {bankFx && <ChestBurst key={bankFx.key} amount={bankFx.amount} onDone={clearBankFx} />}

         <ScoreRibbon
            players={state.players.filter((p) => onlineIds.has(p.id) || p.id === userId)}
            currentPlayerId={currentPlayer?.id}
            youId={userId}
         />

         <div className='relative z-10 text-center'>
            <span className='chip-pirate min-h-6 px-2.5 text-[10px]'>
               <ConnectionDot status={realtimeStatus} compact />
               <span className='pirate-display tracking-widest text-[color:var(--color-gold-300)]'>{code}</span>
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

         <div className='z-20 mt-auto pt-2 safe-bottom'>
            {isComplete ? null : !isCurrent ? (
               <p className='animate-pulse text-center text-sm text-[color:var(--color-cream-200)]/70'>
                  Waiting on {currentPlayer?.name ?? 'the helm'}…
               </p>
            ) : isPirate ? (
               <PirateButton variant='tertiary' size='lg' fullWidth disabled={pending !== null} onClick={handleEndTurn}>
                  {pending === 'end' ? '…' : 'Pass the Helm'}
               </PirateButton>
            ) : (
               <div className='flex gap-3'>
                  <PirateButton
                     variant='primary'
                     size='lg'
                     fullWidth
                     onClick={handleDraw}
                     disabled={!canDraw || pending !== null}>
                     {pending === 'draw' ? '…' : 'Plunder'}
                  </PirateButton>
                  <PirateButton
                     variant='secondary'
                     size='lg'
                     fullWidth
                     onClick={handleBank}
                     disabled={!canBank || pending !== null}>
                     {pending === 'bank' ? '…' : 'Bury It'}
                  </PirateButton>
               </div>
            )}
         </div>

         <VictoryModal
            open={isComplete}
            winner={winner}
            ranked={ranked}
            youId={userId}
            actions={
               <>
                  <PirateButton variant='tertiary' size='md' fullWidth onClick={onLeave}>
                     To port
                  </PirateButton>
                  {isHost ? (
                     <PirateButton
                        variant='treasure'
                        size='md'
                        fullWidth
                        onClick={handlePlayAgain}
                        disabled={restarting}
                     >
                        {restarting ? 'Resetting…' : 'Play again'}
                     </PirateButton>
                  ) : (
                     <span className='inline-flex w-full items-center justify-center rounded-xl border border-[color:var(--color-surface-border)] bg-[color:var(--color-deep-700)]/45 px-4 py-3 text-center text-sm text-[color:var(--color-cream-200)]/70'>
                        Captain be choosing…
                     </span>
                  )}
               </>
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
