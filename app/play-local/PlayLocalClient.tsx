'use client';

import Button from '@/components/button/Button';
import Icon from '@/components/icon/Icon';
import Modal from '@/components/modal/Modal';
import Page from '@/components/page/Page';
import Panel from '@/components/panel/Panel';
import { useGameEngine } from '@/lib/hooks/useGameEngine';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { PlayerInput } from '@/types/game';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
   deckConfig?: string;
   showDeck?: boolean;
}

const PlayLocalClient = ({ deckConfig, showDeck }: Props) => {
   const router = useRouter();
   const initialized = useRef(false);

   const {
      gameState,
      currentPlayer,
      streakValue,
      deckProgress,
      startGame,
      startGameWithPlayers,
      drawCard,
      bankCards,
      endTurn,
      activateHighSeas,
      setHighSeasCount,
      highSeasDraw,
      cancelHighSeas,
      selectCutthroatTarget,
      selectSwapTarget,
      playPowerCard,
      dismissPeek,
      canActivateHighSeas,
      getAvailableActions,
   } = useGameEngine();

   const [showEndGameModal, setShowEndGameModal] = useState<boolean>(false);
   const [lastPlayers, setLastPlayers] = useState<PlayerInput[]>([]);
   const [deckConfigId, setDeckConfigId] = useState<string>('standard');

   // Initialize game on mount
   useEffect(() => {
      if (initialized.current) return;
      initialized.current = true;

      const localStorageDataString: string = `${localStorage.getItem('players')}`;
      const playerData: Array<{ id: string; name: string }> = JSON.parse(localStorageDataString);

      if (playerData?.length) {
         // Read deck config from localStorage (set by setup page) or fall back to prop/default
         const storedDeckConfig = localStorage.getItem('deckConfig');
         const configId = storedDeckConfig || deckConfig || 'standard';
         setDeckConfigId(configId);
         setLastPlayers(playerData.map((p) => ({ id: p.id, name: p.name })));

         startGame(
            playerData.map((p) => ({ id: p.id, name: p.name })),
            configId
         );
      } else {
         router.push('/setup');
      }
   }, [deckConfig, router, startGame]);

   // Show end game modal when game finishes
   useEffect(() => {
      if (gameState.isGameOver && gameState.winner) {
         setShowEndGameModal(true);
      }
   }, [gameState.isGameOver, gameState.winner]);

   // ---- Helpers for rendering ----

   const currentCard = gameState.currentCard;
   const isPirate = currentCard?.type === 'pirate';
   const isCutthroat = currentCard?.type === 'cutthroat';
   const isPower = currentCard?.type === 'power';
   const coinValue = currentCard?.type === 'coin' ? currentCard.value : null;
   const isGameOver = gameState.isGameOver;
   const players = gameState.players;
   const winner = gameState.winner;
   const turnPhase = gameState.turnPhase;

   const canDraw = !isGameOver && gameState.deck.length > 0 && !isPirate && turnPhase === 'drawing';
   const canBank = !isGameOver && gameState.currentStreak.length > 0 && !isPirate && turnPhase === 'drawing';
   const canEndTurn = !isGameOver && isPirate && !gameState.shieldActive;
   const canHighSeas = !isGameOver && canActivateHighSeas();

   // Held power cards for current player
   const heldCards = currentPlayer?.heldCards || [];

   // ---- Keyboard Shortcuts (2G) ----

   useKeyboardShortcuts(
      useMemo(
         () => [
            { key: 'p', action: drawCard, enabled: canDraw },
            { key: 'b', action: bankCards, enabled: canBank },
            { key: 'h', action: activateHighSeas, enabled: canHighSeas },
         ],
         [drawCard, bankCards, activateHighSeas, canDraw, canBank, canHighSeas]
      )
   );

   // ---- Event Handlers ----

   const handlePlayAgain = useCallback(() => {
      setShowEndGameModal(false);
      initialized.current = false;
      startGame(lastPlayers, deckConfigId);
   }, [lastPlayers, deckConfigId, startGame]);

   const handleShuffleCrew = useCallback(() => {
      setShowEndGameModal(false);
      initialized.current = false;
      startGameWithPlayers(lastPlayers, deckConfigId, true);
   }, [lastPlayers, deckConfigId, startGameWithPlayers]);

   const handleChangePlayers = useCallback(() => {
      // Save current game's players to localStorage so setup page pre-populates with current order
      const playerData = gameState.players.map((p) => ({ id: p.id, name: p.name }));
      localStorage.setItem('players', JSON.stringify(playerData));
      router.push('/setup');
   }, [router, gameState.players]);

   // ---- Status message logic ----

   const getStatusMessage = () => {
      if (isGameOver) {
         return 'The treasure be all ours now! Set course for home!';
      }
      if (turnPhase === 'choosingHighSeasCount') {
         return `${currentPlayer?.name}, choose how many cards to draw for High Seas!`;
      }
      if (turnPhase === 'highSeasRevealing') {
         const remaining = gameState.highSeasCardsRemaining;
         if (isPirate && !gameState.shieldActive) {
            return 'High Seas failed! A pirate sank yer gamble!';
         }
         if (remaining === 0) {
            return 'High Seas triumph! Yer bounty be doubled!';
         }
         return `High Seas: ${remaining} card${remaining !== 1 ? 's' : ''} remaining...`;
      }
      if (turnPhase === 'choosingCutthroatTarget') {
         if (gameState.pendingCutthroatCard?.powerEffect === 'swap') {
            return `${currentPlayer?.name}, choose who to swap coin totals with!`;
         }
         const stealAmount = gameState.pendingCutthroatCard?.value || 0;
         const isRevenge = currentPlayer?.hasRevengeStatus;
         return `${currentPlayer?.name}, choose who to steal ${isRevenge ? stealAmount * 2 : stealAmount} coins from!${isRevenge ? ' (Revenge: 2x!)' : ''}`;
      }
      if (turnPhase === 'peeking') {
         return `${currentPlayer?.name} peeks at the top card...`;
      }
      if (gameState.lastPirateBlocked) {
         return 'Shield blocked the pirate! Yer streak be safe, draw again!';
      }
      if (isPirate) {
         return 'Shiver me timbers! Yer greed for gold has lured a pirate to plunder!';
      }
      if (isCutthroat) {
         return `${currentPlayer?.name} drew a Cutthroat card!`;
      }
      if (isPower) {
         return `${currentPlayer?.name} found a ${currentCard?.name} card! It be added to yer hand.`;
      }
      return `${currentPlayer?.name}! Take the helm for it be yer turn!`;
   };

   // ---- Card rendering ----

   const renderCardFace = () => {
      if (!currentCard) {
         // Card back
         return (
            <div className='w-[190px] h-[250px] max-w-[190px] max-h-[250px] p-4 flex justify-center items-center rounded shadow-lg border-[1px] border-slate-500 dark:border-slate-500 bg-slate-800'>
               <div className='w-full h-full border-4 border-teal-500 p-2'>
                  <div className='w-full h-full p-2 flex flex-col items-center justify-center bg-purple-500'>
                     <span className='text-3xl font-semibold text-yellow-500'>Greedy</span>
                     <span className='text-3xl font-semibold text-yellow-500'>Pirate</span>
                  </div>
               </div>
            </div>
         );
      }

      // Determine card background color by type
      let bgClass = 'bg-slate-800';
      if (currentCard.type === 'pirate') bgClass = 'bg-red-900';
      if (currentCard.type === 'cutthroat') bgClass = 'bg-purple-900';
      if (currentCard.type === 'power') bgClass = 'bg-teal-900';

      return (
         <div
            className={`w-[190px] h-[250px] max-w-[190px] max-h-[250px] flex flex-col justify-center items-center rounded border-2 border-black ${bgClass}`}>
            {currentCard.type === 'pirate' ? (
               <Icon name='Pirate' className='fill-purple-500' height={200} />
            ) : currentCard.type === 'coin' && coinValue !== null && coinValue > 5 ? (
               <span className='text-6xl font-bold text-yellow-500'>{coinValue}</span>
            ) : currentCard.type === 'coin' && coinValue !== null ? (
               // @ts-ignore
               <Icon name={`Coin${coinValue}`} className='fill-yellow-500' height={200} />
            ) : currentCard.type === 'cutthroat' ? (
               <div className='flex flex-col items-center gap-2'>
                  <span className='text-2xl font-bold text-red-400'>Cutthroat</span>
                  <span className='text-4xl font-bold text-yellow-500'>{currentCard.value}</span>
                  <span className='text-sm text-gray-300 text-center px-4'>Steal from a crewmate!</span>
               </div>
            ) : currentCard.type === 'power' ? (
               <div className='flex flex-col items-center gap-2'>
                  <span className='text-xl font-bold text-teal-300'>{currentCard.name}</span>
                  <span className='text-sm text-gray-300 text-center px-4'>{currentCard.description}</span>
               </div>
            ) : (
               <span className='text-2xl text-yellow-500'>{currentCard.name}</span>
            )}
         </div>
      );
   };

   // ---- Peek card overlay ----

   const renderPeekOverlay = () => {
      if (turnPhase !== 'peeking' || !gameState.peekCard) return null;
      const peekCard = gameState.peekCard;

      return (
         <div className='fixed inset-0 bg-black/60 flex items-center justify-center z-50'>
            <div className='flex flex-col items-center gap-4 p-6 rounded-lg bg-slate-800 border-2 border-teal-500'>
               <span className='text-lg text-teal-300'>Peek: Next card in the deck</span>
               <div className='w-[160px] h-[210px] flex flex-col justify-center items-center rounded border-2 border-teal-500 bg-slate-700'>
                  {peekCard.type === 'pirate' ? (
                     <div className='flex flex-col items-center'>
                        <Icon name='Pirate' className='fill-red-500' height={120} />
                        <span className='text-red-400 font-bold'>Pirate!</span>
                     </div>
                  ) : peekCard.type === 'coin' ? (
                     <div className='flex flex-col items-center'>
                        <span className='text-4xl font-bold text-yellow-500'>{peekCard.value}</span>
                        <span className='text-yellow-400'>Gold Coin</span>
                     </div>
                  ) : (
                     <div className='flex flex-col items-center text-center px-2'>
                        <span className='text-lg font-bold text-white'>{peekCard.name}</span>
                        <span className='text-sm text-gray-300'>{peekCard.description}</span>
                     </div>
                  )}
               </div>
               <Button color='teal' onClick={dismissPeek}>
                  Got it!
               </Button>
            </div>
         </div>
      );
   };

   // ---- High Seas count picker ----

   const renderHighSeasPicker = () => {
      if (turnPhase !== 'choosingHighSeasCount') return null;
      const maxCards = Math.min(5, gameState.deck.length);

      return (
         <div className='flex flex-col items-center gap-2 p-3 rounded bg-slate-700 border border-teal-500'>
            <span className='text-sm text-teal-300 font-semibold'>How many cards to draw?</span>
            <div className='flex gap-2'>
               {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                     key={n}
                     color='teal'
                     size='xs'
                     disabled={n > maxCards}
                     onClick={() => setHighSeasCount(n)}>
                     {n}
                  </Button>
               ))}
            </div>
            <Button color='purple' size='xs' onClick={cancelHighSeas}>
               Cancel
            </Button>
         </div>
      );
   };

   // ---- High Seas reveal controls ----

   const renderHighSeasRevealControls = () => {
      if (turnPhase !== 'highSeasRevealing') return null;
      const remaining = gameState.highSeasCardsRemaining;
      const drawn = gameState.highSeasCardsDrawn;
      const failed = isPirate && !gameState.shieldActive;
      const succeeded = remaining === 0 && !failed;

      return (
         <div className='flex flex-col items-center gap-2'>
            {/* High Seas drawn cards */}
            {drawn.length > 0 && (
               <div className='flex gap-1'>
                  {drawn.map((card) => (
                     <div
                        key={card.id}
                        className={`w-[28px] text-center rounded-sm ${
                           card.type === 'pirate' ? 'bg-red-600' : 'bg-yellow-500'
                        }`}>
                        <span className={`text-lg font-bold ${card.type === 'pirate' ? 'text-white' : 'text-slate-700'}`}>
                           {card.type === 'pirate' ? '☠' : card.value}
                        </span>
                     </div>
                  ))}
               </div>
            )}
            {!failed && !succeeded && remaining > 0 && (
               <Button color='teal' size='sm' onClick={highSeasDraw}>
                  Reveal Next ({remaining} left)
               </Button>
            )}
            {(failed || succeeded) && (
               <Button color='teal' size='sm' onClick={failed ? endTurn : bankCards}>
                  {failed ? 'End Turn' : 'Bury the Doubled Booty!'}
               </Button>
            )}
         </div>
      );
   };

   // ---- Cutthroat / Swap target selection ----

   const renderTargetSelection = () => {
      if (turnPhase !== 'choosingCutthroatTarget') return null;
      const isSwap = gameState.pendingCutthroatCard?.powerEffect === 'swap';
      const otherPlayers = players.filter((p) => p.id !== currentPlayer?.id);

      return (
         <div className='flex flex-col items-center gap-2 p-3 rounded bg-slate-700 border border-purple-500'>
            <span className='text-sm font-semibold text-purple-300'>
               {isSwap ? 'Swap coins with:' : 'Steal from:'}
            </span>
            <div className='flex flex-col gap-1'>
               {otherPlayers.map((player) => (
                  <Button
                     key={player.id}
                     color='purple'
                     size='xs'
                     onClick={() => (isSwap ? selectSwapTarget(player.id) : selectCutthroatTarget(player.id))}>
                     {player.name} ({player.coins} coins)
                  </Button>
               ))}
            </div>
         </div>
      );
   };

   // ---- Power card hand display (2C) ----

   const renderHeldCards = () => {
      if (heldCards.length === 0) return null;

      return (
         <div className='flex flex-col items-center gap-1 mt-2'>
            <span className='text-xs text-gray-400'>Hand ({heldCards.length}/3)</span>
            <div className='flex gap-1'>
               {heldCards.map((card) => (
                  <button
                     key={card.id}
                     className='px-2 py-1 rounded text-xs font-semibold bg-teal-800 text-teal-200 border border-teal-500 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed'
                     disabled={turnPhase !== 'drawing' || isGameOver || isPirate}
                     onClick={() => playPowerCard(card.id)}
                     title={card.description}>
                     {card.name}
                  </button>
               ))}
            </div>
         </div>
      );
   };

   // ---- Deck progress bar ----

   const renderDeckProgress = () => {
      const pct = Math.round(deckProgress * 100);
      const remaining = gameState.deck.length;
      return (
         <div className='w-full flex flex-col items-center gap-1'>
            <div className='w-full h-2 bg-slate-600 rounded-full overflow-hidden'>
               <div
                  className='h-full bg-teal-500 transition-all duration-300'
                  style={{ width: `${pct}%` }}
               />
            </div>
            <span className='text-xs text-gray-400'>
               {remaining} card{remaining !== 1 ? 's' : ''} left
               {canHighSeas && ' · High Seas available!'}
            </span>
         </div>
      );
   };

   // ---- Results modal (2E fix: winner at #1) ----

   const renderResultsModal = () => {
      const sortedPlayers = [...players].sort((a, b) => b.coins - a.coins);

      return (
         <Modal
            showModal={showEndGameModal}
            onClose={() => setShowEndGameModal(!showEndGameModal)}
            closeOnBackdropClick={false}>
            <div className='w-full flex flex-col items-center px-4 py-2'>
               <span className='text-2xl font-semibold text-yellow-500'>{winner?.name} Wins!</span>
               <span className='text-xl font-semibold text-yellow-500'>
                  Coins: <span className='pl-1'>{winner?.coins}</span>
               </span>
               <div className='w-full max-h-[250px] px-14 flex flex-col flex-wrap'>
                  {sortedPlayers.map((player, index) => (
                     <div key={player.id} className='flex justify-between'>
                        <span className='font-bold'>
                           <span className={`${index === 0 ? 'text-yellow-500' : 'text-gray-400 dark:text-slate-400'}`}>
                              {index + 1}.
                           </span>
                           <span className={`pl-2 font-semibold ${index === 0 ? 'text-yellow-500' : ''}`}>
                              {player.name}
                           </span>
                        </span>
                        <span className={`font-semibold ${index === 0 ? 'text-yellow-500' : 'text-yellow-500'}`}>
                           {player.coins}
                        </span>
                     </div>
                  ))}
               </div>

               <div className='mt-2 flex flex-wrap justify-center gap-3'>
                  <Button color='teal' size='sm' onClick={handleChangePlayers}>
                     Change Players
                  </Button>
                  <Button color='purple' size='sm' onClick={handleShuffleCrew}>
                     Shuffle Crew
                  </Button>
                  <Button color='purple' onClick={handlePlayAgain}>
                     Play Again!
                  </Button>
               </div>
            </div>
         </Modal>
      );
   };

   // ---- Main Render ----

   return (
      <Page>
         <Panel className='flex flex-col items-center gap-4'>
            {/* Status message */}
            <div className='min-h-[30px] flex items-center gap-2 text-center'>
               <span className='text-lg'>{getStatusMessage()}</span>
            </div>

            {/* Deck progress */}
            {!isGameOver && renderDeckProgress()}

            {/* Main game area */}
            <div className='grid grid-cols-3 gap-4'>
               {/* Card display */}
               {renderCardFace()}

               {/* Controls column */}
               <div className='flex flex-col gap-2'>
                  {/* Normal drawing phase controls */}
                  {turnPhase === 'drawing' && (
                     <>
                        <Button color='teal' onClick={drawCard} disabled={!canDraw}>
                           Plunder <span className='text-xs opacity-60 ml-1'>(P)</span>
                        </Button>
                        <Button color='purple' onClick={bankCards} disabled={!canBank}>
                           Bury It <span className='text-xs opacity-60 ml-1'>(B)</span>
                        </Button>
                        {canHighSeas && (
                           <Button color='teal' size='sm' onClick={activateHighSeas}>
                              Sail High Seas <span className='text-xs opacity-60 ml-1'>(H)</span>
                           </Button>
                        )}
                        {canEndTurn && (
                           <Button color='teal' size='sm' onClick={endTurn}>
                              End Turn
                           </Button>
                        )}
                     </>
                  )}

                  {/* High Seas picker (2A) */}
                  {renderHighSeasPicker()}

                  {/* High Seas reveal (2A) */}
                  {renderHighSeasRevealControls()}

                  {/* Cutthroat/Swap target selection (2B, 2C) */}
                  {renderTargetSelection()}

                  {/* Streak display */}
                  <div className='flex justify-center gap-2 pt-2 items-center'>
                     <span>Booty:</span>
                     <span className='text-lg font-semibold text-yellow-500'>{streakValue}</span>
                     {gameState.shieldActive && (
                        <span className='text-xs text-teal-400 border border-teal-500 px-1 rounded'>🛡 Shield</span>
                     )}
                     {gameState.doubleDownActive && (
                        <span className='text-xs text-yellow-400 border border-yellow-500 px-1 rounded'>2x Next</span>
                     )}
                  </div>
                  <div className='flex flex-wrap justify-center gap-2'>
                     {gameState.currentStreak.map((card) => {
                        if (card.type === 'coin' || card.type === 'cutthroat') {
                           return (
                              <div key={card.id} className='w-[28px] text-center rounded-sm bg-yellow-500'>
                                 <span className='text-lg font-bold text-slate-700'>{card.value}</span>
                              </div>
                           );
                        }
                        return null;
                     })}
                  </div>

                  {/* Held power cards (2C) */}
                  {renderHeldCards()}
               </div>

               {/* Player scoreboard */}
               <div className='grid items-center'>
                  <div className='flex flex-col p-2 bg-gray-200 dark:bg-slate-700'>
                     {players.map((player) => (
                        <div
                           key={player.id}
                           className={`max-h-[18px] flex justify-between items-center p-2 rounded ${
                              players.length > 9 ? 'my-[3px]' : 'my-1'
                           }`}>
                           <span className={`text-lg ${player.hasTurn && 'text-teal-500 font-semibold'}`}>
                              {player.name}
                              {player.hasRevengeStatus && (
                                 <span className='text-xs text-red-400 ml-1' title='Revenge: next cutthroat steals 2x'>
                                    ⚔
                                 </span>
                              )}
                           </span>
                           <span className='text-lg font-bold text-yellow-500'>{player.coins}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </Panel>

         {/* Peek overlay (2C) */}
         {renderPeekOverlay()}

         {/* Results modal (2E, 2F) */}
         {renderResultsModal()}
      </Page>
   );
};

export default PlayLocalClient;
