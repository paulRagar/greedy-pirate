import { DECKS } from './deck';
import { DEFAULT_VARIANT, MAX_PLAYERS, MIN_PLAYERS } from './rules';
import { createRng, seedFromString, shuffle } from './shuffle';
import type { GameAction, GameState, GoldCard, Player, PlayerTelemetry } from './types';

const EMPTY_TELEMETRY: PlayerTelemetry = {
   maxStreakLength: 0,
   biggestBank: 0,
   piratesEncountered: 0,
};

/** Immutably patch one player's telemetry entry, defaulting from zero. */
function withTelemetry(
   telemetry: GameState['telemetry'],
   playerId: string,
   fn: (t: PlayerTelemetry) => PlayerTelemetry,
): GameState['telemetry'] {
   return { ...telemetry, [playerId]: fn(telemetry[playerId] ?? EMPTY_TELEMETRY) };
}

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
   absentIds: [],
   telemetry: {},
   rngSeed: '',
   rngCursor: 0,
   amuletArmed: false,
   multiplierRemaining: 0,
   bankLocked: false,
   pendingDecision: null,
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
      case 'SKIP_TURN':
         return handleSkipTurn(state, action.playerId);
      case 'MARK_PRESENT':
         return handleMarkPresent(state, action.playerId);
      case 'TIMEOUT_TURN':
         return handleTimeoutTurn(state, action.playerId);
      case 'MARK_ABSENT':
         return handleMarkAbsent(state, action.playerId);
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
      absentIds: [],
      telemetry: Object.fromEntries(state.players.map((p) => [p.id, EMPTY_TELEMETRY])),
      rngSeed: seed,
      rngCursor: 0,
      amuletArmed: false,
      multiplierRemaining: 0,
      bankLocked: false,
      pendingDecision: null,
   };
}

function handleDraw(state: GameState): GameState {
   assert(state.status === 'active', 'game not active');
   assert(state.currentCard?.kind !== 'pirate', 'pirate revealed; end turn before drawing');
   assert(state.pendingDecision === null, 'resolve the revealed card before drawing');
   assert(state.deck.length > 0, 'deck empty');

   const top = state.deck[0];
   assert(top, 'deck empty');
   const rest = state.deck.slice(1);
   const currentId = state.players[state.turnIndex]?.id;

   if (top.kind === 'pirate') {
      const next: GameState = {
         ...state,
         deck: rest,
         currentCard: top,
         currentStreak: [],
         pirateCount: state.pirateCount + 1,
         telemetry: currentId
            ? withTelemetry(state.telemetry, currentId, (t) => ({
                 ...t,
                 piratesEncountered: t.piratesEncountered + 1,
              }))
            : state.telemetry,
      };
      return rest.length === 0 ? complete(next) : next;
   }

   const streakLength = state.currentStreak.length + 1;
   const drawn: GameState = {
      ...state,
      deck: rest,
      currentCard: top,
      currentStreak: [...state.currentStreak, top],
      telemetry: currentId
         ? withTelemetry(state.telemetry, currentId, (t) => ({
              ...t,
              maxStreakLength: Math.max(t.maxStreakLength, streakLength),
           }))
         : state.telemetry,
   };

   if (rest.length === 0) {
      return complete(bankToCurrentPlayer(drawn));
   }
   return drawn;
}

function handleBank(state: GameState): GameState {
   assert(state.status === 'active', 'game not active');
   assert(state.currentCard?.kind !== 'pirate', 'cannot bank after pirate');
   assert(!state.bankLocked, 'cannot bank during a Cursed Doubloon window');
   assert(state.currentStreak.length > 0, 'no streak to bank');
   const banked = bankToCurrentPlayer(state);
   return advanceTurn({ ...banked, currentCard: null, currentStreak: [] });
}

function handleEndTurn(state: GameState): GameState {
   assert(state.status === 'active', 'game not active');
   assert(state.currentCard?.kind === 'pirate', 'end turn only valid after a pirate draw');
   return advanceTurn({ ...state, currentCard: null });
}

/**
 * Forfeit the current player's turn — used when the player who holds
 * the helm disconnects mid-turn. Drops any in-flight streak (they walked
 * away, no banking) and hands off to the next seat. Idempotent at the
 * caller: SKIP_TURN with a stale playerId is rejected, so a slow client
 * cannot accidentally skip the player who just took over.
 */
function handleSkipTurn(state: GameState, playerId: string): GameState {
   assert(state.status === 'active', 'game not active');
   const current = state.players[state.turnIndex];
   assert(current?.id === playerId, 'turn has already advanced');
   const absentIds = state.absentIds.includes(playerId)
      ? state.absentIds
      : [...state.absentIds, playerId];
   return advanceTurn({ ...state, currentCard: null, currentStreak: [], absentIds });
}

/**
 * The turn shot clock expired on the current player. Resolve their turn the
 * gentle way and hand off — WITHOUT marking them absent (that's SKIP_TURN's
 * job, reserved for a true disconnect). A standing gold streak is banked
 * (mirrors BANK); a revealed pirate or an untouched turn just passes with no
 * coins. The player keeps their seat and their next turn gets a fresh clock.
 * Idempotent at the caller: a stale playerId is rejected so two racing clients
 * can't double-advance.
 */
function handleTimeoutTurn(state: GameState, playerId: string): GameState {
   assert(state.status === 'active', 'game not active');
   const current = state.players[state.turnIndex];
   assert(current?.id === playerId, 'turn has already advanced');
   // bankToCurrentPlayer is a no-op when the streak is empty (pirate showing
   // already wiped it, or the player never drew), so this one path covers all
   // three cases: bank-and-pass, pirate-pass, and empty-pass.
   const banked = bankToCurrentPlayer(state);
   return advanceTurn({ ...banked, currentCard: null, currentStreak: [] });
}

/**
 * Flag a player absent right now — used when they explicitly leave an active
 * game, so the table skips their seat immediately instead of waiting out a
 * presence timeout. Unlike SKIP_TURN this works for any seat, not just the
 * current holder: if they happen to hold the helm we advance past them
 * (dropping any in-flight streak); otherwise we just mark them so future
 * advances bypass their seat. Idempotent.
 */
function handleMarkAbsent(state: GameState, playerId: string): GameState {
   assert(state.status === 'active', 'game not active');
   const absentIds = state.absentIds.includes(playerId)
      ? state.absentIds
      : [...state.absentIds, playerId];
   const current = state.players[state.turnIndex];
   if (current?.id === playerId) {
      return advanceTurn({ ...state, currentCard: null, currentStreak: [], absentIds });
   }
   return { ...state, absentIds };
}

function handleMarkPresent(state: GameState, playerId: string): GameState {
   if (!state.absentIds.includes(playerId)) return state;
   return { ...state, absentIds: state.absentIds.filter((id) => id !== playerId) };
}

function bankToCurrentPlayer(state: GameState): GameState {
   const sum = state.currentStreak.reduce((acc: number, c: GoldCard) => acc + c.value, 0);
   if (sum === 0) return state;
   const currentId = state.players[state.turnIndex]?.id;
   const players = state.players.map((p, i) =>
      i === state.turnIndex ? { ...p, coins: p.coins + sum } : p,
   );
   return {
      ...state,
      players,
      telemetry: currentId
         ? withTelemetry(state.telemetry, currentId, (t) => ({
              ...t,
              biggestBank: Math.max(t.biggestBank, sum),
           }))
         : state.telemetry,
   };
}

function advanceTurn(state: GameState): GameState {
   if (state.players.length === 0) return state;
   // Every turn hand-off clears turn-scoped special-card effects so they can
   // never leak into the next player's turn. Routing all hand-offs through here
   // means no caller can forget. (rngSeed/rngCursor persist for the whole game.)
   const base: GameState = {
      ...state,
      amuletArmed: false,
      multiplierRemaining: 0,
      bankLocked: false,
      pendingDecision: null,
   };
   const n = base.players.length;
   let next = (base.turnIndex + 1) % n;
   // Walk past anyone flagged absent. If everyone is absent, fall back
   // to the original advance — the table is effectively empty but the
   // engine refuses to loop forever.
   for (let i = 0; i < n; i++) {
      const candidate = base.players[next];
      if (candidate && !base.absentIds.includes(candidate.id)) {
         return { ...base, turnIndex: next };
      }
      next = (next + 1) % n;
   }
   return { ...base, turnIndex: (base.turnIndex + 1) % n };
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
