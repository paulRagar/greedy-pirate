'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/client/stores/gameStore';
import { useGameJuice, type JuiceSnapshot } from '@/client/hooks/useGameJuice';
import { DEFAULT_VARIANT } from '@/game/rules';
import type { DeckVariant, PlayerInit } from '@/game/types';
import { persistLocalGame } from '@/server/actions/persistLocalGame';
import { cn } from '@/lib/cn';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateCard } from '@/ui/pirate-card/PirateCard';
import { BustVignette } from '@/ui/effects/BustVignette';
import { ChestBurst } from '@/ui/effects/ChestBurst';
import { ScoreRibbon } from '@/ui/game-room/ScoreRibbon';
import { StreakStrip } from '@/ui/game-room/StreakStrip';
import { VictoryModal } from '@/ui/game-room/VictoryModal';
import { useGameToast } from '@/ui/toast/PirateToast';

interface Props {
   variant?: DeckVariant;
}

type StoredPlayer = { id: string; name: string };

const PLAYERS_KEY = 'players';

export default function PlayLocalClient({ variant = DEFAULT_VARIANT }: Props) {
   const router = useRouter();
   const state = useGameStore((s) => s.state);
   const dispatch = useGameStore((s) => s.dispatch);
   const reset = useGameStore((s) => s.reset);
   const { toastElement, showToast } = useGameToast();

   const startedFor = useRef<string | null>(null);
   const persistedFor = useRef<string | null>(null);

   useEffect(() => {
      if (state.status !== 'complete' || !state.winnerId) return;
      const key = `${state.players.map((p) => p.id).join(',')}:${state.winnerId}`;
      if (persistedFor.current === key) return;
      persistedFor.current = key;
      void persistLocalGame({
         deckVariant: state.variant,
         players: state.players.map((p) => ({ id: p.id, name: p.name, coins: p.coins })),
         winnerSeatId: state.winnerId,
         pirateCount: state.pirateCount,
      }).catch((err) => console.error('persistLocalGame error', err));
   }, [state.status, state.winnerId, state.players, state.variant, state.pirateCount]);

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
   const { bankFx, clearBankFx, shakeKey } = useGameJuice(snap);

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
      dispatch({ type: 'BANK' });
   };

   const playAgain = () => {
      startedFor.current = null;
      persistedFor.current = null;
      reset();
   };

   if (isBootstrapping) {
      return (
         <main className='flex flex-1 items-center justify-center px-5 py-10'>
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
         {isPirate && !isComplete && <BustVignette />}
         {toastElement}
         {bankFx && <ChestBurst key={bankFx.key} amount={bankFx.amount} onDone={clearBankFx} />}

         <ScoreRibbon players={state.players} currentPlayerId={currentPlayer?.id} />

         <StatusBanner
            isComplete={isComplete}
            isPirate={isPirate}
            playerName={currentPlayer?.name}
            streakSum={streakSum}
         />

         <div className='relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-2'>
            <div className='relative flex min-h-0 w-full flex-1 justify-center'>
               <PirateCard card={state.currentCard} />
            </div>
            <StreakStrip streak={state.currentStreak} />
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
                  <PirateButton variant='tertiary' size='md' fullWidth onClick={() => router.push('/setup')}>
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
   let title = playerName ? `${playerName}, it be yer turn!` : '';
   let subtitle = `Booty in hand: ${streakSum}`;
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
