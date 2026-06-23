import { describe, expect, it } from 'vitest';
import { DECKS } from './deck';
import { EngineError, initialState, reduce } from './engine';
import { MAX_PLAYERS } from './rules';
import type { GameAction, GameState, Player, PlayerInit } from './types';

const p = (id: string, name = id): PlayerInit => ({ id, name });

function buildLobby(...players: PlayerInit[]): GameState {
   return players.reduce<GameState>((s, player) => reduce(s, { type: 'PLAYER_JOIN', player }), initialState);
}

function startGame(state: GameState, seed = 'test-seed'): GameState {
   return reduce(state, { type: 'START_GAME', seed });
}

function dispatch(state: GameState, ...actions: GameAction[]): GameState {
   return actions.reduce(reduce, state);
}

function findPlayer(state: GameState, id: string): Player {
   const found = state.players.find((pl) => pl.id === id);
   if (!found) throw new Error(`player ${id} missing`);
   return found;
}

function drawUntilGold(state: GameState): GameState {
   let s = state;
   while (s.deck.length > 0 && s.currentCard?.kind !== 'gold') {
      s = reduce(s, { type: 'DRAW' });
      if (s.currentCard?.kind === 'pirate') {
         s = reduce(s, { type: 'END_TURN' });
      }
   }
   return s;
}

describe('PLAYER_JOIN', () => {
   it('adds players with zero coins', () => {
      const s = buildLobby(p('a'), p('b'));
      expect(s.players).toHaveLength(2);
      expect(s.players[0]).toMatchObject({ id: 'a', coins: 0 });
   });

   it('rejects duplicate ids', () => {
      const s = buildLobby(p('a'));
      expect(() => reduce(s, { type: 'PLAYER_JOIN', player: p('a') })).toThrow(EngineError);
   });

   it('rejects when lobby full', () => {
      let s: GameState = initialState;
      for (let i = 0; i < MAX_PLAYERS; i++) s = reduce(s, { type: 'PLAYER_JOIN', player: p(`p${i}`) });
      expect(() => reduce(s, { type: 'PLAYER_JOIN', player: p('overflow') })).toThrow(/full/);
   });

   it('rejects after game started', () => {
      const s = startGame(buildLobby(p('a'), p('b')));
      expect(() => reduce(s, { type: 'PLAYER_JOIN', player: p('c') })).toThrow(/after game start/);
   });
});

describe('PLAYER_LEAVE', () => {
   it('removes the player from the lobby roster', () => {
      const s = buildLobby(p('a'), p('b'), p('c'));
      const next = reduce(s, { type: 'PLAYER_LEAVE', playerId: 'b' });
      expect(next.players.map((pl) => pl.id)).toEqual(['a', 'c']);
   });

   it('is a no-op when the player was never aboard', () => {
      const s = buildLobby(p('a'));
      const next = reduce(s, { type: 'PLAYER_LEAVE', playerId: 'ghost' });
      expect(next.players).toEqual(s.players);
   });

   it('rejects after the game has started — kicks during active games unsupported', () => {
      const started = startGame(buildLobby(p('a'), p('b')));
      expect(() => reduce(started, { type: 'PLAYER_LEAVE', playerId: 'b' })).toThrow(
         /after game start/,
      );
   });
});

describe('START_GAME', () => {
   it('requires minimum players', () => {
      const solo = buildLobby(p('a'));
      expect(() => startGame(solo)).toThrow(/at least/);
   });

   it('produces deterministic deck given same seed', () => {
      const lobby = buildLobby(p('a'), p('b'));
      const g1 = startGame(lobby, 'same-seed');
      const g2 = startGame(lobby, 'same-seed');
      expect(g1.deck).toEqual(g2.deck);
   });

   it('produces different deck given different seed', () => {
      const lobby = buildLobby(p('a'), p('b'));
      const g1 = startGame(lobby, 'seed-1');
      const g2 = startGame(lobby, 'seed-2');
      expect(g1.deck).not.toEqual(g2.deck);
   });

   it('transitions status to active with full deck', () => {
      const s = startGame(buildLobby(p('a'), p('b')));
      expect(s.status).toBe('active');
      expect(s.deck.length).toBe(DECKS.greedy.length);
   });

   it('retains the seed on state with a zeroed rng cursor', () => {
      const s = startGame(buildLobby(p('a'), p('b')), 'keep-me');
      expect(s.rngSeed).toBe('keep-me');
      expect(s.rngCursor).toBe(0);
   });

   it('zeroes turn-scoped special-card effect state', () => {
      const s = startGame(buildLobby(p('a'), p('b')));
      expect(s.amuletArmed).toBe(false);
      expect(s.multiplierRemaining).toBe(0);
      expect(s.bankLocked).toBe(false);
      expect(s.pendingDecision).toBeNull();
   });
});

describe('DRAW gold', () => {
   it('appends gold to streak, keeps turn', () => {
      // Force a seed where top card is gold. With variant greedy, gold dominates so most seeds work.
      let s = startGame(buildLobby(p('a'), p('b')), 'gold-seed-1');
      s = drawUntilGold(s);
      const turnBefore = s.turnIndex;
      const streakBefore = s.currentStreak.length;
      s = reduce(s, { type: 'DRAW' });
      expect(s.currentCard?.kind).toBe('gold');
      expect(s.currentStreak.length).toBe(streakBefore + 1);
      expect(s.turnIndex).toBe(turnBefore);
   });
});

describe('DRAW pirate', () => {
   it('clears streak and increments pirateCount; turn stays until END_TURN', () => {
      let s = startGame(buildLobby(p('a'), p('b')), 'pirate-seed');
      let pirateCount = 0;
      // draw until a pirate appears
      while (s.deck.length > 0 && s.currentCard?.kind !== 'pirate') {
         s = reduce(s, { type: 'DRAW' });
         if (s.currentCard?.kind === 'pirate') pirateCount = s.pirateCount;
      }
      expect(s.currentCard?.kind).toBe('pirate');
      expect(s.currentStreak).toEqual([]);
      expect(s.pirateCount).toBe(pirateCount);
   });

   it('rejects DRAW while pirate revealed', () => {
      let s = startGame(buildLobby(p('a'), p('b')), 'pirate-seed');
      while (s.deck.length > 0 && s.currentCard?.kind !== 'pirate') {
         s = reduce(s, { type: 'DRAW' });
      }
      expect(s.currentCard?.kind).toBe('pirate');
      expect(() => reduce(s, { type: 'DRAW' })).toThrow(/end turn/i);
   });
});

describe('BANK', () => {
   it('adds streak sum to current player and advances turn', () => {
      let s = startGame(buildLobby(p('a'), p('b')), 'gold-seed-1');
      s = drawUntilGold(s);
      s = reduce(s, { type: 'DRAW' });
      const sum = s.currentStreak.reduce((acc, c) => acc + c.value, 0);
      const actorId = s.players[s.turnIndex]!.id;
      const coinsBefore = findPlayer(s, actorId).coins;
      s = reduce(s, { type: 'BANK' });
      expect(findPlayer(s, actorId).coins).toBe(coinsBefore + sum);
      expect(s.currentStreak).toEqual([]);
      expect(s.currentCard).toBeNull();
      expect(s.players[s.turnIndex]!.id).not.toBe(actorId);
   });

   it('rejects with empty streak', () => {
      const s = startGame(buildLobby(p('a'), p('b')), 'any');
      expect(() => reduce(s, { type: 'BANK' })).toThrow(/no streak/);
   });

   it('rejects after pirate revealed', () => {
      let s = startGame(buildLobby(p('a'), p('b')), 'pirate-seed');
      while (s.deck.length > 0 && s.currentCard?.kind !== 'pirate') {
         s = reduce(s, { type: 'DRAW' });
      }
      expect(() => reduce(s, { type: 'BANK' })).toThrow(/pirate/);
   });
});

describe('END_TURN', () => {
   it('advances turn after pirate', () => {
      let s = startGame(buildLobby(p('a'), p('b')), 'pirate-seed');
      while (s.deck.length > 0 && s.currentCard?.kind !== 'pirate') {
         s = reduce(s, { type: 'DRAW' });
      }
      const before = s.turnIndex;
      s = reduce(s, { type: 'END_TURN' });
      expect(s.turnIndex).not.toBe(before);
      expect(s.currentCard).toBeNull();
   });

   it('rejects without pirate', () => {
      const s = startGame(buildLobby(p('a'), p('b')), 'any');
      expect(() => reduce(s, { type: 'END_TURN' })).toThrow(/pirate/);
   });
});

describe('SKIP_TURN', () => {
   it('advances turn and clears the streak mid-flight', () => {
      let s = startGame(buildLobby(p('a'), p('b'), p('c')), 'gold-seed-1');
      s = drawUntilGold(s);
      s = reduce(s, { type: 'DRAW' });
      const dropping = s.players[s.turnIndex]!;
      const streakBefore = s.currentStreak.length;
      expect(streakBefore).toBeGreaterThan(0);
      s = reduce(s, { type: 'SKIP_TURN', playerId: dropping.id });
      expect(s.currentStreak).toEqual([]);
      expect(s.currentCard).toBeNull();
      expect(s.players[s.turnIndex]!.id).not.toBe(dropping.id);
   });

   it('works after a pirate has been revealed', () => {
      let s = startGame(buildLobby(p('a'), p('b')), 'pirate-seed');
      while (s.deck.length > 0 && s.currentCard?.kind !== 'pirate') {
         s = reduce(s, { type: 'DRAW' });
      }
      const dropping = s.players[s.turnIndex]!;
      s = reduce(s, { type: 'SKIP_TURN', playerId: dropping.id });
      expect(s.currentCard).toBeNull();
      expect(s.players[s.turnIndex]!.id).not.toBe(dropping.id);
   });

   it('rejects when the named player no longer holds the helm', () => {
      const s = startGame(buildLobby(p('a'), p('b')), 'any');
      const wrongId = s.players[(s.turnIndex + 1) % s.players.length]!.id;
      expect(() => reduce(s, { type: 'SKIP_TURN', playerId: wrongId })).toThrow(/already advanced/);
   });

   it('rejects when game not active', () => {
      const s = buildLobby(p('a'), p('b'));
      expect(() => reduce(s, { type: 'SKIP_TURN', playerId: 'a' })).toThrow(/not active/);
   });

   it('flags the skipped player absent so future advances bypass them', () => {
      let s = startGame(buildLobby(p('a'), p('b'), p('c')), 'gold-seed-1');
      const dropping = s.players[s.turnIndex]!;
      s = reduce(s, { type: 'SKIP_TURN', playerId: dropping.id });
      expect(s.absentIds).toContain(dropping.id);
      // Cycle the table — a turn that would have landed on `dropping`
      // should jump over them.
      const seen: string[] = [];
      let cursor = s;
      for (let i = 0; i < s.players.length * 2; i++) {
         const holder = cursor.players[cursor.turnIndex]!;
         seen.push(holder.id);
         cursor = drawUntilGold(cursor);
         if (cursor.currentStreak.length > 0) {
            cursor = reduce(cursor, { type: 'BANK' });
         } else if (cursor.currentCard?.kind === 'pirate') {
            cursor = reduce(cursor, { type: 'END_TURN' });
         } else {
            break;
         }
      }
      expect(seen).not.toContain(dropping.id);
   });
});

describe('TIMEOUT_TURN', () => {
   it('banks a standing gold streak and advances, leaving the player present', () => {
      let s = startGame(buildLobby(p('a'), p('b'), p('c')), 'gold-seed-1');
      s = drawUntilGold(s);
      s = reduce(s, { type: 'DRAW' });
      const holder = s.players[s.turnIndex]!;
      const sum = s.currentStreak.reduce((acc, c) => acc + c.value, 0);
      expect(sum).toBeGreaterThan(0);
      const coinsBefore = findPlayer(s, holder.id).coins;
      s = reduce(s, { type: 'TIMEOUT_TURN', playerId: holder.id });
      expect(findPlayer(s, holder.id).coins).toBe(coinsBefore + sum);
      expect(s.currentStreak).toEqual([]);
      expect(s.currentCard).toBeNull();
      expect(s.players[s.turnIndex]!.id).not.toBe(holder.id);
      // Shot clock never removes — the player keeps their seat in rotation.
      expect(s.absentIds).not.toContain(holder.id);
   });

   it('passes with no coins on an untouched turn', () => {
      const s = startGame(buildLobby(p('a'), p('b')), 'any');
      const holder = s.players[s.turnIndex]!;
      const next = reduce(s, { type: 'TIMEOUT_TURN', playerId: holder.id });
      expect(findPlayer(next, holder.id).coins).toBe(0);
      expect(next.players[next.turnIndex]!.id).not.toBe(holder.id);
      expect(next.absentIds).not.toContain(holder.id);
   });

   it('passes after a pirate has been revealed (no coins)', () => {
      let s = startGame(buildLobby(p('a'), p('b')), 'pirate-seed');
      while (s.deck.length > 0 && s.currentCard?.kind !== 'pirate') {
         s = reduce(s, { type: 'DRAW' });
      }
      expect(s.currentCard?.kind).toBe('pirate');
      const holder = s.players[s.turnIndex]!;
      const coinsBefore = findPlayer(s, holder.id).coins;
      s = reduce(s, { type: 'TIMEOUT_TURN', playerId: holder.id });
      expect(findPlayer(s, holder.id).coins).toBe(coinsBefore);
      expect(s.currentCard).toBeNull();
      expect(s.players[s.turnIndex]!.id).not.toBe(holder.id);
   });

   it('rejects when the named player no longer holds the helm', () => {
      const s = startGame(buildLobby(p('a'), p('b')), 'any');
      const wrongId = s.players[(s.turnIndex + 1) % s.players.length]!.id;
      expect(() => reduce(s, { type: 'TIMEOUT_TURN', playerId: wrongId })).toThrow(
         /already advanced/,
      );
   });

   it('rejects when game not active', () => {
      const s = buildLobby(p('a'), p('b'));
      expect(() => reduce(s, { type: 'TIMEOUT_TURN', playerId: 'a' })).toThrow(/not active/);
   });
});

describe('MARK_ABSENT', () => {
   it('flags a non-current player absent without advancing the turn', () => {
      const s = startGame(buildLobby(p('a'), p('b'), p('c')), 'gold-seed-1');
      const holder = s.players[s.turnIndex]!;
      const other = s.players.find((pl) => pl.id !== holder.id)!;
      const next = reduce(s, { type: 'MARK_ABSENT', playerId: other.id });
      expect(next.absentIds).toContain(other.id);
      expect(next.turnIndex).toBe(s.turnIndex); // turn didn't move
      expect(next.players[next.turnIndex]!.id).toBe(holder.id);
   });

   it('advances the turn when the absent player held the helm', () => {
      let s = startGame(buildLobby(p('a'), p('b'), p('c')), 'gold-seed-1');
      s = drawUntilGold(s);
      s = reduce(s, { type: 'DRAW' });
      const holder = s.players[s.turnIndex]!;
      expect(s.currentStreak.length).toBeGreaterThan(0);
      const next = reduce(s, { type: 'MARK_ABSENT', playerId: holder.id });
      expect(next.absentIds).toContain(holder.id);
      expect(next.currentStreak).toEqual([]);
      expect(next.currentCard).toBeNull();
      expect(next.players[next.turnIndex]!.id).not.toBe(holder.id);
   });

   it('is idempotent and rejects when not active', () => {
      const s = startGame(buildLobby(p('a'), p('b')), 'any');
      const once = reduce(s, { type: 'MARK_ABSENT', playerId: 'b' });
      const twice = reduce(once, { type: 'MARK_ABSENT', playerId: 'b' });
      expect(twice.absentIds.filter((id) => id === 'b')).toHaveLength(1);
      const lobby = buildLobby(p('a'), p('b'));
      expect(() => reduce(lobby, { type: 'MARK_ABSENT', playerId: 'a' })).toThrow(/not active/);
   });
});

describe('MARK_PRESENT', () => {
   it('removes a player from the absent list', () => {
      let s = startGame(buildLobby(p('a'), p('b'), p('c')), 'gold-seed-1');
      const dropping = s.players[s.turnIndex]!;
      s = reduce(s, { type: 'SKIP_TURN', playerId: dropping.id });
      expect(s.absentIds).toContain(dropping.id);
      s = reduce(s, { type: 'MARK_PRESENT', playerId: dropping.id });
      expect(s.absentIds).not.toContain(dropping.id);
   });

   it('is a no-op for someone never marked absent', () => {
      const s = startGame(buildLobby(p('a'), p('b')), 'any');
      const next = reduce(s, { type: 'MARK_PRESENT', playerId: 'a' });
      expect(next).toBe(s);
   });
});

describe('game completion', () => {
   it('last gold draw auto-banks and completes', () => {
      let s = startGame(buildLobby(p('a'), p('b')), 'finish-seed');
      let safety = 200;
      while (s.status === 'active' && safety-- > 0) {
         if (s.currentCard?.kind === 'pirate') {
            s = reduce(s, { type: 'END_TURN' });
         } else {
            s = reduce(s, { type: 'DRAW' });
         }
      }
      expect(s.status).toBe('complete');
      expect(s.winnerId).not.toBeNull();
   });

   it('winner is highest coins', () => {
      let s = startGame(buildLobby(p('a'), p('b'), p('c')), 'rank-seed');
      let safety = 500;
      while (s.status === 'active' && safety-- > 0) {
         if (s.currentCard?.kind === 'pirate') s = reduce(s, { type: 'END_TURN' });
         else s = reduce(s, { type: 'DRAW' });
      }
      const ranked = [...s.players].sort((a, b) => b.coins - a.coins);
      expect(s.winnerId).toBe(ranked[0]!.id);
   });

   it('rejects DRAW after completion', () => {
      let s = startGame(buildLobby(p('a'), p('b')), 'finish-seed');
      let safety = 200;
      while (s.status === 'active' && safety-- > 0) {
         if (s.currentCard?.kind === 'pirate') s = reduce(s, { type: 'END_TURN' });
         else s = reduce(s, { type: 'DRAW' });
      }
      expect(() => reduce(s, { type: 'DRAW' })).toThrow(/not active/);
   });
});

describe('telemetry', () => {
   const gold = (value: number) => ({ kind: 'gold' as const, value });
   const pirate = () => ({ kind: 'pirate' as const });

   // Active 2-player game with a hand-controlled deck. startGame already
   // seeds zeroed telemetry for the seated players; we only swap the deck.
   function activeWithDeck(deck: GameState['deck']): GameState {
      const started = startGame(buildLobby(p('a'), p('b')));
      return { ...started, deck, currentCard: null, currentStreak: [] };
   }

   it('records max streak length and biggest bank on a banked run', () => {
      let s = activeWithDeck([gold(1), gold(2), gold(3), gold(1), gold(1)]);
      const actor = s.players[s.turnIndex]!.id;
      s = dispatch(s, { type: 'DRAW' }, { type: 'DRAW' }, { type: 'DRAW' }, { type: 'BANK' });
      expect(s.telemetry[actor]!.maxStreakLength).toBe(3);
      expect(s.telemetry[actor]!.biggestBank).toBe(6);
      expect(s.telemetry[actor]!.piratesEncountered).toBe(0);
   });

   it('keeps the streak high-water mark after a bust', () => {
      let s = activeWithDeck([gold(4), gold(5), pirate(), gold(1)]);
      const actor = s.players[s.turnIndex]!.id;
      s = dispatch(s, { type: 'DRAW' }, { type: 'DRAW' }, { type: 'DRAW' });
      expect(s.currentCard?.kind).toBe('pirate');
      expect(s.telemetry[actor]!.maxStreakLength).toBe(2);
      expect(s.telemetry[actor]!.biggestBank).toBe(0);
      expect(s.telemetry[actor]!.piratesEncountered).toBe(1);
   });

   it('tracks the biggest single bank per player across turns', () => {
      let s = activeWithDeck([gold(5), gold(8), gold(3), gold(1), gold(1)]);
      const a = s.players[0]!.id;
      const b = s.players[1]!.id;
      s = dispatch(
         s,
         { type: 'DRAW' },
         { type: 'BANK' }, // a banks 5, turn -> b
         { type: 'DRAW' },
         { type: 'BANK' }, // b banks 8, turn -> a
         { type: 'DRAW' },
         { type: 'BANK' }, // a banks 3 (< 5, no change)
      );
      expect(s.telemetry[a]!.biggestBank).toBe(5);
      expect(s.telemetry[b]!.biggestBank).toBe(8);
   });

   it('attributes pirates to the player who drew them', () => {
      let s = activeWithDeck([pirate(), gold(1), gold(1)]);
      const a = s.players[0]!.id;
      const b = s.players[1]!.id;
      s = dispatch(s, { type: 'DRAW' }, { type: 'END_TURN' }, { type: 'DRAW' });
      expect(s.telemetry[a]!.piratesEncountered).toBe(1);
      expect(s.telemetry[b]!.piratesEncountered).toBe(0);
   });

   it('resets telemetry on START_GAME', () => {
      const started = startGame(buildLobby(p('a'), p('b')));
      expect(started.telemetry).toEqual({
         a: { maxStreakLength: 0, biggestBank: 0, piratesEncountered: 0 },
         b: { maxStreakLength: 0, biggestBank: 0, piratesEncountered: 0 },
      });
   });
});

describe('purity', () => {
   it('does not mutate input state', () => {
      const lobby = buildLobby(p('a'), p('b'));
      const frozen = JSON.parse(JSON.stringify(lobby));
      reduce(lobby, { type: 'START_GAME', seed: 's' });
      expect(lobby).toEqual(frozen);
   });

   it('same seed + actions → identical final states', () => {
      const lobby = buildLobby(p('a'), p('b'));
      const actions: GameAction[] = [
         { type: 'START_GAME', seed: 'parity' },
         { type: 'DRAW' },
         { type: 'DRAW' },
      ];
      const r1 = dispatch(lobby, ...actions);
      const r2 = dispatch(lobby, ...actions);
      expect(r1).toEqual(r2);
   });
});
