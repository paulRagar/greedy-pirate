import { buildDeck } from './deck';
import {
   DAVEY_WAGER,
   DEFAULT_VARIANT,
   MAX_PLAYERS,
   MIN_PLAYERS,
   MULTIPLIER_FACTOR,
   MULTIPLIER_WINDOW,
} from './rules';
import { createRng, seedFromString, shuffle } from './shuffle';
import type { Rng } from './shuffle';
import type { Card, GameAction, GameState, GoldCard, Player, PlayerTelemetry } from './types';

const EMPTY_TELEMETRY: PlayerTelemetry = {
   maxStreakLength: 0,
   biggestBank: 0,
   piratesEncountered: 0,
   amuletsSaved: 0,
   monkeyStolen: 0,
   monkeyLost: 0,
   daveyWins: 0,
   daveyLosses: 0,
};

/**
 * Deterministic per-event RNG, derived from the persisted seed + cursor. Used
 * for in-game randomness (Davey Jones' toss) that must survive past the shuffle
 * and reproduce on replay. The `#` namespace keeps this stream independent of
 * the deck-shuffle stream, so adding tosses never perturbs deck order. Callers
 * MUST bump `rngCursor` once per consumed event so the next draw differs.
 */
function eventRng(state: GameState): Rng {
   return createRng(seedFromString(`${state.rngSeed}#${state.rngCursor}`));
}

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
   daveyToss: null,
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
      case 'RESOLVE_MULTIPLIER':
         return handleResolveMultiplier(state, action.secure);
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
   const rng = createRng(seedFromString(seed));
   const deck = shuffle(buildDeck(variant, rng), rng);
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
      daveyToss: null,
   };
}

function handleDraw(state: GameState): GameState {
   assert(state.status === 'active', 'game not active');
   assert(state.currentCard?.kind !== 'pirate', 'pirate revealed; end turn before drawing');
   assert(state.currentCard?.kind !== 'davey_jones', 'Davey Jones revealed; end turn before drawing');
   assert(state.pendingDecision === null, 'resolve the revealed card before drawing');
   assert(state.deck.length > 0, 'deck empty');

   const top = state.deck[0];
   assert(top, 'deck empty');
   const rest = state.deck.slice(1);
   const lastCard = rest.length === 0;
   const currentId = state.players[state.turnIndex]?.id;

   switch (top.kind) {
      case 'pirate':
         return drawPirate(state, top, rest, lastCard, currentId);
      case 'gold':
         return drawGold(state, top, rest, lastCard, currentId);
      case 'monkey':
         return drawMonkey(state, top, rest, lastCard, currentId);
      case 'davey_jones':
         return drawDaveyJones(state, top, rest, lastCard, currentId);
      case 'spyglass': {
         // Reveal-only: the next-3 peek is computed by the caller (actor-only).
         // The card just passes through; the turn continues. As the final card
         // there's nothing to peek — bank the standing streak and end.
         const drawn: GameState = { ...state, deck: rest, currentCard: top, daveyToss: null };
         return lastCard ? complete(bankToCurrentPlayer(drawn)) : drawn;
      }
      case 'amulet': {
         // Arm the one-shot shield; the card passes through, turn continues.
         const drawn: GameState = {
            ...state,
            deck: rest,
            currentCard: top,
            amuletArmed: true,
            daveyToss: null,
         };
         return lastCard ? complete(bankToCurrentPlayer(drawn)) : drawn;
      }
      case 'multiplier': {
         // Park for the holder's secure-or-ride decision. As the final card the
         // 2× window has nothing to act on — bank the standing streak and end.
         const drawn: GameState = { ...state, deck: rest, currentCard: top, daveyToss: null };
         if (lastCard) return complete(bankToCurrentPlayer(drawn));
         return { ...drawn, pendingDecision: { kind: 'multiplier' } };
      }
   }
}

function streakSum(streak: ReadonlyArray<GoldCard>): number {
   return streak.reduce((acc, c) => acc + c.value, 0);
}

function drawPirate(
   state: GameState,
   pirate: Card,
   rest: ReadonlyArray<Card>,
   lastCard: boolean,
   currentId: string | undefined,
): GameState {
   // Amulet intercept: keep HALF the streak (round down), bank it. The turn
   // still ends like any pirate (await END_TURN), but the player walks away with
   // something instead of nothing.
   if (state.amuletArmed && state.currentStreak.length > 0) {
      const saved = Math.floor(streakSum(state.currentStreak) / 2);
      const players = state.players.map((p, i) =>
         i === state.turnIndex ? { ...p, coins: p.coins + saved } : p,
      );
      const telemetry = currentId
         ? withTelemetry(state.telemetry, currentId, (t) => ({
              ...t,
              piratesEncountered: t.piratesEncountered + 1,
              amuletsSaved: t.amuletsSaved + 1,
              biggestBank: Math.max(t.biggestBank, saved),
           }))
         : state.telemetry;
      const next: GameState = {
         ...state,
         deck: rest,
         currentCard: pirate,
         currentStreak: [],
         pirateCount: state.pirateCount + 1,
         amuletArmed: false,
         players,
         telemetry,
         daveyToss: null,
      };
      return lastCard ? complete(next) : next;
   }

   const next: GameState = {
      ...state,
      deck: rest,
      currentCard: pirate,
      currentStreak: [],
      pirateCount: state.pirateCount + 1,
      telemetry: currentId
         ? withTelemetry(state.telemetry, currentId, (t) => ({
              ...t,
              piratesEncountered: t.piratesEncountered + 1,
           }))
         : state.telemetry,
      daveyToss: null,
   };
   return lastCard ? complete(next) : next;
}

function drawGold(
   state: GameState,
   gold: GoldCard,
   rest: ReadonlyArray<Card>,
   lastCard: boolean,
   currentId: string | undefined,
): GameState {
   // Cursed Doubloon window: double the gold value and tick the window down.
   // When the window closes, the bank-lock lifts too.
   const inWindow = state.multiplierRemaining > 0;
   const card: GoldCard = inWindow ? { kind: 'gold', value: gold.value * MULTIPLIER_FACTOR } : gold;
   const multiplierRemaining = inWindow ? state.multiplierRemaining - 1 : 0;
   const bankLocked = multiplierRemaining > 0 ? state.bankLocked : false;
   const streakLength = state.currentStreak.length + 1;
   const drawn: GameState = {
      ...state,
      deck: rest,
      currentCard: card,
      currentStreak: [...state.currentStreak, card],
      multiplierRemaining,
      bankLocked,
      daveyToss: null,
      telemetry: currentId
         ? withTelemetry(state.telemetry, currentId, (t) => ({
              ...t,
              maxStreakLength: Math.max(t.maxStreakLength, streakLength),
           }))
         : state.telemetry,
   };
   return lastCard ? complete(bankToCurrentPlayer(drawn)) : drawn;
}

function drawMonkey(
   state: GameState,
   monkey: Card,
   rest: ReadonlyArray<Card>,
   lastCard: boolean,
   currentId: string | undefined,
): GameState {
   // Pickpocket 1 coin from every OTHER player who has any; the loot joins the
   // drawer's streak (still at risk until banked) as a single synthetic coin.
   const victims = state.players.filter((p, i) => i !== state.turnIndex && p.coins > 0);
   const steal = victims.length;
   const players = state.players.map((p, i) => {
      if (i === state.turnIndex) return p;
      return p.coins > 0 ? { ...p, coins: p.coins - 1 } : p;
   });
   const currentStreak =
      steal > 0
         ? [...state.currentStreak, { kind: 'gold' as const, value: steal }]
         : state.currentStreak;
   let telemetry = state.telemetry;
   if (currentId && steal > 0) {
      telemetry = withTelemetry(telemetry, currentId, (t) => ({
         ...t,
         monkeyStolen: t.monkeyStolen + steal,
         maxStreakLength: Math.max(t.maxStreakLength, currentStreak.length),
      }));
      for (const v of victims) {
         telemetry = withTelemetry(telemetry, v.id, (t) => ({ ...t, monkeyLost: t.monkeyLost + 1 }));
      }
   }
   const drawn: GameState = {
      ...state,
      deck: rest,
      currentCard: monkey,
      players,
      currentStreak,
      telemetry,
      daveyToss: null,
   };
   return lastCard ? complete(bankToCurrentPlayer(drawn)) : drawn;
}

function drawDaveyJones(
   state: GameState,
   davey: Card,
   rest: ReadonlyArray<Card>,
   lastCard: boolean,
   currentId: string | undefined,
): GameState {
   // The dread of the deck. The streak is dragged under immediately (a pirate-
   // level loss). Then a forced wager from the BANK — DAVEY_WAGER, or the whole
   // bank if it holds less — on a deterministic coin toss. Win doubles the
   // wager into the bank; lose sinks it. The turn ends (await END_TURN). The
   // only card that can shrink banked treasure. Empty bank → just the streak.
   const bank = state.players[state.turnIndex]?.coins ?? 0;
   const wager = Math.min(DAVEY_WAGER, bank);
   let players = state.players;
   let daveyToss: GameState['daveyToss'] = null;
   let rngCursor = state.rngCursor;
   let telemetry = state.telemetry;
   if (wager > 0) {
      const won = eventRng(state)() < 0.5;
      rngCursor = state.rngCursor + 1;
      const delta = won ? wager : -wager;
      players = state.players.map((p, i) =>
         i === state.turnIndex ? { ...p, coins: p.coins + delta } : p,
      );
      daveyToss = { won, amount: wager };
      if (currentId) {
         telemetry = withTelemetry(telemetry, currentId, (t) =>
            won ? { ...t, daveyWins: t.daveyWins + 1 } : { ...t, daveyLosses: t.daveyLosses + 1 },
         );
      }
   }
   const next: GameState = {
      ...state,
      deck: rest,
      currentCard: davey,
      currentStreak: [],
      players,
      rngCursor,
      daveyToss,
      telemetry,
   };
   return lastCard ? complete(next) : next;
}

function handleResolveMultiplier(state: GameState, secure: boolean): GameState {
   assert(state.status === 'active', 'game not active');
   assert(state.pendingDecision?.kind === 'multiplier', 'no Cursed Doubloon decision pending');
   if (secure) {
      // Decline the curse: bank the standing streak (if any) and END the turn.
      // There is no bank-and-keep-drawing — declining means walking away safe.
      const banked =
         state.currentStreak.length > 0
            ? { ...bankToCurrentPlayer(state), currentStreak: [] }
            : state;
      return advanceTurn({ ...banked, currentCard: null });
   }
   // Take the chance: open a forced-push 2× window — the next 3 gold cards are
   // doubled, but banking is locked until the window closes (or a pirate ends it).
   return {
      ...state,
      currentCard: null,
      pendingDecision: null,
      multiplierRemaining: MULTIPLIER_WINDOW,
      bankLocked: true,
   };
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
   const kind = state.currentCard?.kind;
   assert(
      kind === 'pirate' || kind === 'davey_jones',
      'end turn only valid after a pirate or Davey Jones',
   );
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
      daveyToss: null,
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
