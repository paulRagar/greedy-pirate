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
import { VictoryModal } from '@/ui/game-room/VictoryModal';
import { useGameToast } from '@/ui/toast/PirateToast';

interface Props {
   variant?: DeckVariant;
}

type StoredPlayer = { id: string; name: string };

const PLAYERS_KEY = 'players';

export default function PlayLocalClient({ variant = DEFAULT_VARIANT }: Props) {
   const router = useRouter();
   const [changingCrew, startChangeCrew] = useTransition();
   const state = useGameStore((s) => s.state);
   const dispatch = useGameStore((s) => s.dispatch);
   const reset = useGameStore((s) => s.reset);
   const { toastElement, showToast } = useGameToast();

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
         streakLength: state.currentStreak.length,
         players: state.players.map((p) => ({ id: p.id, coins: p.coins })),
         isMyTurn: true, // hot-seat — every turn is "yours"
      }),
      [state],
   );
   const { shakeKey } = useGameJuice(snap);

   // Bank burst: captured at bank time (the engine clears the streak immediately)
   // so the chips can slide into the chest after they've gone from state.
   const [bankBurst, setBankBurst] = useState<{ key: number; coins: number[]; amount: number } | null>(null);
   const bankBurstKey = useRef(0);

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

   // Pirate reveal moment — toast once per reveal.
   useEffect(() => {
      if (isPirate) showToast('Robbed!', 'blood');
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isPirate]);

   const handleDraw = () => {
      dispatch({ type: 'DRAW' });
   };

   const handleBank = () => {
      showToast(`Banked ${streakSum}!`, 'gold');
      setBankBurst({
         key: (bankBurstKey.current += 1),
         coins: state.currentStreak.map((c) => c.value),
         amount: streakSum,
      });
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
         {toastElement}

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
            {bankBurst ? (
               <StreakBankBurst
                  key={bankBurst.key}
                  coins={bankBurst.coins}
                  amount={bankBurst.amount}
                  onDone={() => setBankBurst(null)}
               />
            ) : (
               <StreakBoard streak={state.currentStreak} />
            )}
         </div>

         <div className='z-20 mt-auto px-0 pt-2 safe-bottom'>
            {isPirate ? (
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
            open={isComplete}
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
