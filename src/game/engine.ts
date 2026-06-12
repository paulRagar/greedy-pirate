import { DECKS } from './deck';
import { DEFAULT_VARIANT, MAX_PLAYERS, MIN_PLAYERS } from './rules';
import { createRng, seedFromString, shuffle } from './shuffle';
import type { GameAction, GameState, GoldCard, Player } from './types';

export class EngineError extends Error {
   constructor(message: string) {
      super(message);
      this.name = 'EngineError';
   }
}

function assert(cond: unknown, msg: string): asserts cond {
   if (!cond) throw new EngineError(msg);
}

export const initialState: GameState = {
   status: 'lobby',
   players: [],
   turnIndex: 0,
   deck: [],
   currentCard: null,
   currentStreak: [],
   pirateCount: 0,
   variant: DEFAULT_VARIANT,
   winnerId: null,
};

export function reduce(state: GameState, action: GameAction): GameState {
   switch (action.type) {
      case 'PLAYER_JOIN':
         return handleJoin(state, action.player);
      case 'PLAYER_LEAVE':
         return handleLeave(state, action.playerId);
      case 'START_GAME':
         return handleStart(state, action.seed, action.variant);
      case 'DRAW':
         return handleDraw(state);
      case 'BANK':
         return handleBank(state);
      case 'END_TURN':
         return handleEndTurn(state);
   }
}

function handleJoin(state: GameState, player: { id: string; name: string }): GameState {
   assert(state.status === 'lobby', 'cannot add player after game start');
   assert(state.players.length < MAX_PLAYERS, `lobby full (max ${MAX_PLAYERS})`);
   assert(!state.players.some((p) => p.id === player.id), 'player already in lobby');
   const next: Player = { id: player.id, name: player.name, coins: 0 };
   return { ...state, players: [...state.players, next] };
}

function handleLeave(state: GameState, playerId: string): GameState {
   assert(state.status === 'lobby', 'cannot remove player after game start');
   return { ...state, players: state.players.filter((p) => p.id !== playerId) };
}

function handleStart(state: GameState, seed: string, variant = state.variant): GameState {
   assert(state.status === 'lobby', 'game already started');
   assert(state.players.length >= MIN_PLAYERS, `need at least ${MIN_PLAYERS} players`);
   const base = DECKS[variant];
   const rng = createRng(seedFromString(seed));
   const deck = shuffle(base, rng);
   return {
      ...state,
      status: 'active',
      variant,
      deck,
      turnIndex: 0,
      currentCard: null,
      currentStreak: [],
      pirateCount: 0,
      winnerId: null,
   };
}

function handleDraw(state: GameState): GameState {
   assert(state.status === 'active', 'game not active');
   assert(state.currentCard?.kind !== 'pirate', 'pirate revealed; end turn before drawing');
   assert(state.deck.length > 0, 'deck empty');

   const top = state.deck[0];
   assert(top, 'deck empty');
   const rest = state.deck.slice(1);

   if (top.kind === 'pirate') {
      const next: GameState = {
         ...state,
         deck: rest,
         currentCard: top,
         currentStreak: [],
         pirateCount: state.pirateCount + 1,
      };
      return rest.length === 0 ? complete(next) : next;
   }

   const drawn: GameState = {
      ...state,
      deck: rest,
      currentCard: top,
      currentStreak: [...state.currentStreak, top],
   };

   if (rest.length === 0) {
      return complete(bankToCurrentPlayer(drawn));
   }
   return drawn;
}

function handleBank(state: GameState): GameState {
   assert(state.status === 'active', 'game not active');
   assert(state.currentCard?.kind !== 'pirate', 'cannot bank after pirate');
   assert(state.currentStreak.length > 0, 'no streak to bank');
   const banked = bankToCurrentPlayer(state);
   return advanceTurn({ ...banked, currentCard: null, currentStreak: [] });
}

function handleEndTurn(state: GameState): GameState {
   assert(state.status === 'active', 'game not active');
   assert(state.currentCard?.kind === 'pirate', 'end turn only valid after a pirate draw');
   return advanceTurn({ ...state, currentCard: null });
}

function bankToCurrentPlayer(state: GameState): GameState {
   const sum = state.currentStreak.reduce((acc: number, c: GoldCard) => acc + c.value, 0);
   if (sum === 0) return state;
   const players = state.players.map((p, i) =>
      i === state.turnIndex ? { ...p, coins: p.coins + sum } : p,
   );
   return { ...state, players };
}

function advanceTurn(state: GameState): GameState {
   if (state.players.length === 0) return state;
   const turnIndex = (state.turnIndex + 1) % state.players.length;
   return { ...state, turnIndex };
}

function complete(state: GameState): GameState {
   const ranked = [...state.players].sort((a, b) => b.coins - a.coins);
   const winner = ranked[0];
   return {
      ...state,
      status: 'complete',
      currentStreak: [],
      winnerId: winner ? winner.id : null,
   };
}
