import { describe, expect, it } from 'vitest';
import { EngineError, initialState, reduce } from './engine';
import type { Card, GameAction, GameState, PlayerInit } from './types';

const p = (id: string): PlayerInit => ({ id, name: id });

function buildLobby(...players: PlayerInit[]): GameState {
   return players.reduce<GameState>(
      (s, player) => reduce(s, { type: 'PLAYER_JOIN', player }),
      initialState,
   );
}

/** Active game with a hand-controlled deck and optional starting coins. */
function active(deck: Card[], opts: { players?: string[]; coins?: Record<string, number>; seed?: string } = {}): GameState {
   const ids = opts.players ?? ['a', 'b'];
   const started = reduce(buildLobby(...ids.map(p)), { type: 'START_GAME', seed: opts.seed ?? 'test-seed' });
   const players = started.players.map((pl) => ({ ...pl, coins: opts.coins?.[pl.id] ?? 0 }));
   return { ...started, deck, players, currentCard: null, currentStreak: [] };
}

const gold = (value: number): Card => ({ kind: 'gold', value });
const dispatch = (s: GameState, ...a: GameAction[]) => a.reduce(reduce, s);
const turnCoins = (s: GameState) => s.players[s.turnIndex]!.coins;

describe('Spyglass', () => {
   it('reveals (passes through) and lets the turn continue; peek = next 3 of the deck', () => {
      let s = active([{ kind: 'spyglass' }, gold(1), gold(2), gold(3), gold(4)]);
      const peekBefore = s.deck.slice(1, 4); // what the next 3 will be after spyglass pops
      s = reduce(s, { type: 'DRAW' });
      expect(s.currentCard?.kind).toBe('spyglass');
      expect(s.currentStreak).toEqual([]);
      // The caller computes the peek as the top 3 of the post-draw deck.
      expect(s.deck.slice(0, 3)).toEqual(peekBefore);
      // Turn continues — drawing is allowed and matches the preview.
      s = reduce(s, { type: 'DRAW' });
      expect(s.currentCard).toEqual(peekBefore[0]);
   });

   it('as the final card banks the standing streak and completes', () => {
      let s = active([gold(2), { kind: 'spyglass' }]);
      const actor = s.players[s.turnIndex]!.id;
      s = dispatch(s, { type: 'DRAW' }, { type: 'DRAW' });
      expect(s.status).toBe('complete');
      expect(s.players.find((x) => x.id === actor)!.coins).toBe(2);
   });
});

describe('Amulet', () => {
   it('softens the next pirate — keeps half the streak (round down), banks it', () => {
      let s = active([{ kind: 'amulet' }, gold(4), gold(3), { kind: 'pirate' }, gold(1)]);
      const actor = s.players[s.turnIndex]!.id;
      s = dispatch(s, { type: 'DRAW' }); // amulet armed
      expect(s.amuletArmed).toBe(true);
      s = dispatch(s, { type: 'DRAW' }, { type: 'DRAW' }); // streak 4,3 = 7
      s = reduce(s, { type: 'DRAW' }); // pirate
      expect(s.currentCard?.kind).toBe('pirate');
      expect(s.players.find((x) => x.id === actor)!.coins).toBe(3); // floor(7/2)
      expect(s.currentStreak).toEqual([]);
      expect(s.pirateCount).toBe(1);
      expect(s.telemetry[actor]!.amuletsSaved).toBe(1);
      // Turn ends like a normal pirate (await END_TURN).
      s = reduce(s, { type: 'END_TURN' });
      expect(s.players[s.turnIndex]!.id).not.toBe(actor);
   });

   it('shield expires on hand-off if no pirate appears', () => {
      let s = active([{ kind: 'amulet' }, gold(2), gold(9)]);
      s = dispatch(s, { type: 'DRAW' }, { type: 'DRAW' }, { type: 'BANK' });
      expect(s.amuletArmed).toBe(false);
   });
});

describe('Cursed Doubloon (multiplier)', () => {
   it('parks a decision; RIDE keeps the streak and 2× the next 3 golds, bank locked', () => {
      let s = active([{ kind: 'multiplier' }, gold(2), gold(3), gold(1), gold(9)]);
      s = reduce(s, { type: 'DRAW' });
      expect(s.currentCard?.kind).toBe('multiplier');
      expect(s.pendingDecision).toEqual({ kind: 'multiplier' });
      expect(() => reduce(s, { type: 'DRAW' })).toThrow(/resolve/i);
      s = reduce(s, { type: 'RESOLVE_MULTIPLIER', secure: false });
      expect(s.multiplierRemaining).toBe(3);
      expect(s.bankLocked).toBe(true);
      s = reduce(s, { type: 'DRAW' }); // gold(2) -> 4
      expect(s.currentStreak.at(-1)!.value).toBe(4);
      expect(() => reduce(s, { type: 'BANK' })).toThrow(/Cursed Doubloon/);
      s = reduce(s, { type: 'DRAW' }); // gold(3) -> 6
      s = reduce(s, { type: 'DRAW' }); // gold(1) -> 2, window closes
      expect(s.multiplierRemaining).toBe(0);
      expect(s.bankLocked).toBe(false);
      const actor = s.players[s.turnIndex]!.id;
      s = reduce(s, { type: 'BANK' }); // 4 + 6 + 2 = 12
      expect(s.players.find((x) => x.id === actor)!.coins).toBe(12);
   });

   it('DECLINE (secure) banks the standing streak and ends the turn — no window', () => {
      let s = active([gold(5), { kind: 'multiplier' }, gold(2)]);
      const actor = s.players[s.turnIndex]!.id;
      s = dispatch(s, { type: 'DRAW' }, { type: 'DRAW' }); // streak [5], then multiplier
      s = reduce(s, { type: 'RESOLVE_MULTIPLIER', secure: true });
      expect(s.players.find((x) => x.id === actor)!.coins).toBe(5); // 5 banked safely
      expect(s.currentStreak).toEqual([]);
      expect(s.multiplierRemaining).toBe(0); // no window — declined
      expect(s.bankLocked).toBe(false);
      expect(s.currentCard).toBeNull();
      expect(s.players[s.turnIndex]!.id).not.toBe(actor); // turn ended
   });
});

describe('Monkey', () => {
   it('steals 1 from each rival with coins (skips 0) into the at-risk streak', () => {
      let s = active([{ kind: 'monkey' }, gold(1)], { players: ['a', 'b', 'c'], coins: { a: 0, b: 5, c: 0 } });
      s = reduce(s, { type: 'DRAW' });
      expect(s.currentCard?.kind).toBe('monkey');
      expect(s.players.find((x) => x.id === 'b')!.coins).toBe(4); // robbed 1
      expect(s.players.find((x) => x.id === 'c')!.coins).toBe(0); // skipped
      expect(s.currentStreak.at(-1)!.value).toBe(1); // 1 rival had coins
      expect(s.telemetry.a!.monkeyStolen).toBe(1);
      expect(s.telemetry.b!.monkeyLost).toBe(1);
   });

   it('stolen loot is lost if the drawer then busts on a pirate', () => {
      let s = active([{ kind: 'monkey' }, { kind: 'pirate' }], {
         players: ['a', 'b'],
         coins: { a: 0, b: 3 },
      });
      s = dispatch(s, { type: 'DRAW' }, { type: 'DRAW' });
      expect(s.currentCard?.kind).toBe('pirate');
      expect(s.currentStreak).toEqual([]); // loot was in the streak, now wiped
      expect(s.players.find((x) => x.id === 'a')!.coins).toBe(0);
   });
});

describe('Davey Jones', () => {
   it('drags the streak under, then forces a 5-coin bank wager on a coin toss', () => {
      let s = active([gold(2), { kind: 'davey_jones' }, gold(1)], { coins: { a: 10 } });
      const actor = s.players[s.turnIndex]!.id;
      s = reduce(s, { type: 'DRAW' }); // gold(2) -> streak [2]
      s = reduce(s, { type: 'DRAW' }); // Davey
      expect(s.currentCard?.kind).toBe('davey_jones');
      expect(s.currentStreak).toEqual([]); // streak dragged under
      expect(s.daveyToss).not.toBeNull();
      expect(s.daveyToss!.amount).toBe(5);
      expect(s.rngCursor).toBe(1);
      const coins = s.players.find((x) => x.id === actor)!.coins;
      expect(coins).toBe(s.daveyToss!.won ? 15 : 5); // 10 ±5
      s = reduce(s, { type: 'END_TURN' }); // ends like a pirate
      expect(s.players[s.turnIndex]!.id).not.toBe(actor);
   });

   it('wagers the whole bank when it holds less than 5', () => {
      let s = active([{ kind: 'davey_jones' }], { coins: { a: 3 } });
      s = reduce(s, { type: 'DRAW' });
      expect(s.daveyToss!.amount).toBe(3);
      expect(turnCoins(s)).toBe(s.daveyToss!.won ? 6 : 0);
   });

   it('with an empty bank just loses the streak — no toss', () => {
      let s = active([gold(4), { kind: 'davey_jones' }], { coins: { a: 0 } });
      s = dispatch(s, { type: 'DRAW' }, { type: 'DRAW' });
      expect(s.daveyToss).toBeNull();
      expect(s.rngCursor).toBe(0);
      expect(turnCoins(s)).toBe(0);
      expect(s.currentStreak).toEqual([]);
   });

   it('toss is deterministic — same seed + actions reproduce the outcome', () => {
      const mk = () => active([{ kind: 'davey_jones' }], { coins: { a: 20 }, seed: 'davey-parity' });
      const r1 = reduce(mk(), { type: 'DRAW' });
      const r2 = reduce(mk(), { type: 'DRAW' });
      expect(r1.daveyToss).toEqual(r2.daveyToss);
      expect(r1.players).toEqual(r2.players);
   });

   it('rejects DRAW while Davey Jones is revealed (must END_TURN)', () => {
      let s = active([{ kind: 'davey_jones' }, gold(1)], { coins: { a: 8 } });
      s = reduce(s, { type: 'DRAW' });
      expect(() => reduce(s, { type: 'DRAW' })).toThrow(/end turn/i);
   });
});

describe('RESOLVE_MULTIPLIER guards', () => {
   it('rejects when no multiplier decision is pending', () => {
      const s = active([gold(1)]);
      expect(() => reduce(s, { type: 'RESOLVE_MULTIPLIER', secure: true })).toThrow(EngineError);
   });
});
