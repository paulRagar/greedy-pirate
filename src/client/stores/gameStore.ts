import { create } from 'zustand';
import { initialState, reduce } from '@/game/engine';
import type { GameAction, GameState } from '@/game/types';

type GameStore = {
   state: GameState;
   dispatch: (action: GameAction) => void;
   reset: () => void;
};

export const useGameStore = create<GameStore>((set) => ({
   state: initialState,
   dispatch: (action) =>
      set((store) => ({
         state: reduce(store.state, action),
      })),
   reset: () => set({ state: initialState }),
}));
