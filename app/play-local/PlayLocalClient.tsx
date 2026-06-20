'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/client/stores/gameStore';
import { useGameJuice, type JuiceSnapshot } from '@/client/hooks/useGameJuice';
import { useGameAnnouncer } from '@/client/hooks/useGameAnnouncer';
import type { AnnounceSnapshot } from '@/client/a11y/gameAnnouncement';
import { DEFAULT_VARIANT } from '@/game/rules';
import type { DeckVariant, PlayerInit } from '@/game/types';
import { cn } from '@/lib/cn';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { BustVignette } from '@/ui/effects/BustVignette';
import { DeckDiscard } from '@/ui/game-room/DeckDiscard';
import { ScoreRibbon } from '@/ui/game-room/ScoreRibbon';
import { StreakBoard } from '@/ui/game-room/StreakBoard';
import { StreakBankBurst } from '@/ui/game-room/StreakBankBurst';
import { PirateSinkBurst } from '@/ui/game-room/PirateSinkBurst';
import { VictoryModal } from '@/ui/game-room/VictoryModal';

interface Props {
   variant?: DeckVariant;
}

type StoredPlayer = { id: string; name: string };

const PLAYERS_KEY = 'players';

// Deal animation (~440ms) plus a beat to see the final card resolve (bank or
// sink) before the modal.
const VICTORY_DELAY_MS = 1100;

export default function PlayLocalClient({ variant = DEFAULT_VARIANT }: Props) {
   const router = useRouter();
   const [changingCrew, startChangeCrew] = useTransition();
   const state = useGameStore((s) => s.state);
   const dispatch = useGameStore((s) => s.dispatch);
   const reset = useGameStore((s) => s.reset);

   const startedFor = useRef<string | null>(null);

   // Local pass-and-play is intentionally ephemeral — nothing is persisted to
   // the server, and it never touches the signed-in user's stats/achievements.

   useEffect(() => {
      if (state.status !== 'lobby') return;
      const raw = localStorage.getItem(PLAYERS_KEY);
      let stored: StoredPlayer[] = [];
      try {
         stored = raw ? (JSON.parse(raw) as StoredPlayer[]) : [];
      } catch {
         stored = [];
      }
      if (!stored.length) {
         router.push('/setup');
         return;
      }
      const fingerprint = `${variant}:${stored.map((p) => p.id).join(',')}`;
      if (startedFor.current === fingerprint) return;
      startedFor.current = fingerprint;
      stored.forEach((player: PlayerInit) => dispatch({ type: 'PLAYER_JOIN', player }));
      const seed = typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      dispatch({ type: 'START_GAME', seed, variant });
   }, [state.status, variant, dispatch, router]);

   const currentPlayer = state.players[state.turnIndex];
   const isPirate = state.currentCard?.kind === 'pirate';
   const isComplete = state.status === 'complete';
   const isBootstrapping = state.status === 'lobby';
   const winner = state.winnerId ? (state.players.find((p) => p.id === state.winnerId) ?? null) : null;
   const ranked = isComplete ? [...state.players].sort((a, b) => b.coins - a.coins) : [];
   const streakSum = state.currentStreak.reduce((sum, c) => sum + c.value, 0);
   const canDraw = state.status === 'active' && !isPirate && state.deck.length > 0;
   const canBank = state.status === 'active' && !isPirate && state.currentStreak.length > 0;

   const snap = useMemo<JuiceSnapshot>(
      () => ({
         status: state.status,
         turnIndex: state.turnIndex,
         currentCardKind: state.currentCard?.kind ?? null,
         currentCardValue: state.currentCard?.kind === 'gold' ? state.currentCard.value : null,
         streakLength: state.currentStreak.length,
         streak: state.currentStreak.map((c) => c.value),
         players: state.players.map((p) => ({ id: p.id, coins: p.coins })),
         isMyTurn: true, // hot-seat — every turn is "yours"
      }),
      [state],
   );
   // Bank/sink bursts are derived from state transitions (the engine clears the
   // streak the instant a pirate or bank lands, so the hook captures the lost
   // coins from the previous snapshot).
   const { bankFx, clearBankFx, sinkFx, clearSinkFx, shakeKey } = useGameJuice(snap);

   const announceSnap = useMemo<AnnounceSnapshot>(
      () => ({
         status: state.status,
         turnIndex: state.turnIndex,
         currentCardKind: state.currentCard?.kind ?? null,
         currentName: currentPlayer?.name ?? null,
         winnerName: winner?.name ?? null,
         isMyTurn: true, // hot-seat — every turn is "yours"
      }),
      [state.status, state.turnIndex, state.currentCard, currentPlayer?.name, winner?.name],
   );
   const { announcer } = useGameAnnouncer(announceSnap);

   const [shaking, setShaking] = useState(false);
   useEffect(() => {
      if (shakeKey > 0) setShaking(true);
   }, [shakeKey]);

   // Hold the victory modal until the final card has landed and players have had
   // a beat to register it was the last one.
   const [showVictory, setShowVictory] = useState(false);
   useEffect(() => {
      if (!isComplete) {
         setShowVictory(false);
         return;
      }
      const t = setTimeout(() => setShowVictory(true), VICTORY_DELAY_MS);
      return () => clearTimeout(t);
   }, [isComplete]);

   const handleDraw = () => {
      dispatch({ type: 'DRAW' });
   };

   const handleBank = () => {
      dispatch({ type: 'BANK' });
   };

   const playAgain = () => {
      startedFor.current = null;
      reset();
   };

   if (isBootstrapping) {
      return (
         <main className='flex flex-1 items-center justify-center px-5 py-10'>
            {announcer}
            <p className='pirate-display animate-pulse text-2xl text-[color:var(--color-gold-300)]'>
               Shuffling the deck…
            </p>
         </main>
      );
   }

   return (
      <main
         className={cn('flex min-h-0 flex-1 flex-col gap-2 px-4 pt-2 sm:gap-3', shaking && 'animate-bust-shake')}
         onAnimationEnd={(e) => {
            if (e.animationName === 'bust-shake') setShaking(false);
         }}
      >
         {announcer}
         {isPirate && !isComplete && <BustVignette />}

         <ScoreRibbon players={state.players} currentPlayerId={currentPlayer?.id} />

         <StatusBanner
            isComplete={isComplete}
            isPirate={isPirate}
            playerName={currentPlayer?.name}
            streakSum={streakSum}
         />

         <div className='relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-2'>
            <div className='relative flex min-h-0 w-full flex-1 items-center justify-center'>
               <DeckDiscard currentCard={state.currentCard} deckCount={state.deck.length} />
            </div>
            {/* Live streak wins so a fresh draw shows the total instantly; a
                bank/sink burst plays only while the streak is empty. */}
            {state.currentStreak.length > 0 ? (
               <StreakBoard streak={state.currentStreak} />
            ) : bankFx ? (
               <StreakBankBurst key={bankFx.key} coins={bankFx.coins} amount={bankFx.amount} onDone={clearBankFx} />
            ) : sinkFx ? (
               <PirateSinkBurst key={sinkFx.key} coins={sinkFx.coins} onDone={clearSinkFx} />
            ) : (
               <StreakBoard streak={state.currentStreak} />
            )}
         </div>

         {/* Reserve the action-row height so hiding the buttons at game end
             doesn't drop the cards down a few pixels. */}
         <div className='z-20 mt-auto min-h-[64px] px-0 pt-2 safe-bottom'>
            {isComplete ? null : isPirate ? (
               <PirateButton variant='tertiary' size='lg' fullWidth onClick={() => dispatch({ type: 'END_TURN' })}>
                  Pass the Helm
               </PirateButton>
            ) : (
               <div className='flex gap-3'>
                  <PirateButton variant='primary' size='lg' fullWidth onClick={handleDraw} disabled={!canDraw}>
                     Plunder
                  </PirateButton>
                  <PirateButton variant='secondary' size='lg' fullWidth onClick={handleBank} disabled={!canBank}>
                     Bury It
                  </PirateButton>
               </div>
            )}
         </div>

         <VictoryModal
            open={showVictory}
            winner={winner}
            ranked={ranked}
            actions={
               <>
                  <PirateButton
                     variant='tertiary'
                     size='md'
                     fullWidth
                     loading={changingCrew}
                     onClick={() => startChangeCrew(() => router.push('/setup'))}
                  >
                     Change Crew
                  </PirateButton>
                  <PirateButton variant='treasure' size='md' fullWidth onClick={playAgain}>
                     Sail Again
                  </PirateButton>
               </>
            }
         />
      </main>
   );
}

function StatusBanner({
   isComplete,
   isPirate,
   playerName,
   streakSum,
}: {
   isComplete: boolean;
   isPirate: boolean;
   playerName: string | undefined;
   streakSum: number;
}) {
   // The running total below the cards now shows the booty, so the banner just
   // prompts the action rather than repeating the number.
   let title = playerName ? `${playerName}, it be yer turn!` : '';
   let subtitle = streakSum > 0 ? 'Push yer luck, or bury the loot.' : 'Plunder to start yer streak.';
   let titleClass = 'text-[color:var(--color-gold-300)]';
   if (isComplete) {
      title = 'The deck is empty.';
      subtitle = 'All the loot has been claimed.';
   } else if (isPirate) {
      title = 'Pirate!';
      subtitle = 'Yer streak be sunk. Pass the helm.';
      titleClass = 'text-[color:var(--color-coral-500)]';
   }
   return (
      <div className='relative z-10 min-h-[60px] text-center'>
         <h2 className={`pirate-display text-2xl sm:text-4xl ${titleClass}`}>{title}</h2>
         <p className='mt-1 text-sm text-[color:var(--color-cream-200)]/75'>{subtitle}</p>
      </div>
   );
}
