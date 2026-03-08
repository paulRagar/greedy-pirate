'use client';

import { useCallback, useRef, useState } from 'react';
import { GameState, PlayerInput, TurnAction } from '@/types/game';
import { GameEngine } from '@/lib/engine/GameEngine';

/**
 * React hook that wraps the GameEngine class.
 * Exposes game state as React state and provides memoized action callbacks.
 */
export function useGameEngine() {
   const engineRef = useRef<GameEngine>(new GameEngine());
   const [gameState, setGameState] = useState<GameState>(engineRef.current.getState());

   // Helper: run an engine method and sync React state
   const sync = useCallback((result: GameState) => {
      setGameState(result);
      return result;
   }, []);

   // ---- Game Lifecycle ----

   const startGame = useCallback(
      (players: PlayerInput[], deckConfigId: string) => {
         const state = engineRef.current.startGame(players, deckConfigId);
         return sync(state);
      },
      [sync]
   );

   const startGameWithPlayers = useCallback(
      (players: PlayerInput[], deckConfigId: string, shufflePlayers: boolean = false) => {
         const state = engineRef.current.startGameWithPlayers(players, deckConfigId, shufflePlayers);
         return sync(state);
      },
      [sync]
   );

   // ---- Core Actions ----

   const drawCard = useCallback(() => {
      return sync(engineRef.current.drawCard());
   }, [sync]);

   const bankCards = useCallback(() => {
      return sync(engineRef.current.bankCards());
   }, [sync]);

   const endTurn = useCallback(() => {
      return sync(engineRef.current.endTurn());
   }, [sync]);

   // ---- High Seas ----

   const activateHighSeas = useCallback(() => {
      return sync(engineRef.current.activateHighSeas());
   }, [sync]);

   const setHighSeasCount = useCallback(
      (count: number) => {
         return sync(engineRef.current.setHighSeasCount(count));
      },
      [sync]
   );

   const highSeasDraw = useCallback(() => {
      return sync(engineRef.current.highSeasDraw());
   }, [sync]);

   const cancelHighSeas = useCallback(() => {
      return sync(engineRef.current.cancelHighSeas());
   }, [sync]);

   // ---- Cutthroat ----

   const selectCutthroatTarget = useCallback(
      (targetPlayerId: string) => {
         return sync(engineRef.current.selectCutthroatTarget(targetPlayerId));
      },
      [sync]
   );

   // ---- Power Cards ----

   const playPowerCard = useCallback(
      (cardId: string) => {
         return sync(engineRef.current.playPowerCard(cardId));
      },
      [sync]
   );

   const dismissPeek = useCallback(() => {
      return sync(engineRef.current.dismissPeek());
   }, [sync]);

   const selectSwapTarget = useCallback(
      (targetPlayerId: string) => {
         return sync(engineRef.current.selectSwapTarget(targetPlayerId));
      },
      [sync]
   );

   // ---- Queries ----

   const canActivateHighSeas = useCallback(() => {
      return engineRef.current.canActivateHighSeas();
   }, []);

   const getAvailableActions = useCallback((): TurnAction[] => {
      return engineRef.current.getAvailableActions();
   }, []);

   // ---- Computed Values ----

   const currentPlayer = gameState.players[gameState.currentPlayerIndex] || null;

   const streakValue = gameState.currentStreak.reduce((sum, card) => {
      // Sum all cards with a value (coins always, cutthroat cards added during High Seas)
      return sum + (card.value || 0);
   }, 0);

   const deckProgress = gameState.originalDeckSize > 0
      ? gameState.cardsPlayed / gameState.originalDeckSize
      : 0;

   return {
      // State
      gameState,
      currentPlayer,
      streakValue,
      deckProgress,

      // Lifecycle
      startGame,
      startGameWithPlayers,

      // Core actions
      drawCard,
      bankCards,
      endTurn,

      // High Seas
      activateHighSeas,
      setHighSeasCount,
      highSeasDraw,
      cancelHighSeas,

      // Cutthroat
      selectCutthroatTarget,

      // Power cards
      playPowerCard,
      dismissPeek,
      selectSwapTarget,

      // Queries
      canActivateHighSeas,
      getAvailableActions,
   };
}
