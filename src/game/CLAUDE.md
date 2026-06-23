# `src/game/` — Pure game engine

This directory contains the **single source of truth** for Greedy Pirate's rules. Everything here is pure TypeScript: no React, no DB, no network, no `Date.now()`, no `Math.random()`.

Both local mode (browser) and online mode (server) call into this engine. The rules cannot diverge between modes because the rules live in one place.

## Files

| File | Responsibility |
|---|---|
| `types.ts` | `Card`, `Deck`, `Player`, `GameState`, `GameAction`. Discriminated unions. Everything `readonly`. |
| `rules.ts` | Game constants — min/max players, variant names. |
| `deck.ts` | Deck variants as static data. |
| `shuffle.ts` | Seeded PRNG (mulberry32) + Fisher-Yates shuffle. Pure given the same seed. |
| `engine.ts` | The reducer — `reduce(state, action) → state`. |
| `index.ts` | Re-exports the public API. |

## Engine contract

```ts
function reduce(state: GameState, action: GameAction): GameState;
```

**Rules:**
1. **Pure.** Same `(state, action)` pair → same result. No side effects.
2. **No internal IO.** No clock, no random except via the seeded RNG given through `START_GAME`.
3. **Caller supplies the seed** for `START_GAME`. Local mode can use `crypto.randomUUID()`; server should use a stronger source and persist it.
4. **Invalid actions throw** `EngineError` with a descriptive message. The caller validates intent before dispatching.
5. **State is treated as immutable.** Every action returns a new object — never mutates `state`.

## Action semantics

| Action | Preconditions | Effect |
|---|---|---|
| `PLAYER_JOIN` | status='lobby', not full, id unique | Append player with 0 coins |
| `PLAYER_LEAVE` | status='lobby' | Remove player |
| `START_GAME` | status='lobby', ≥ MIN_PLAYERS | Shuffle deck (seeded), transition to 'active' |
| `DRAW` | status='active', deck non-empty, no pirate/Davey revealed, no pending decision | Reveal top card. Gold → append to streak (2× while a Cursed Doubloon window runs). Pirate → wipe streak (or, if `amuletArmed`, keep half + bank it), increment pirate count. Special cards resolve per `game-rules.md`. Last card → auto-complete (gold auto-banks). |
| `RESOLVE_MULTIPLIER` | status='active', `pendingDecision.kind === 'multiplier'` | `secure` banks the standing streak first; either way opens a 3-card 2× window with `bankLocked`. |
| `BANK` | status='active', streak non-empty, no pirate revealed, **not `bankLocked`** | Sum streak → current player coins. Advance turn. |
| `END_TURN` | status='active', pirate **or Davey Jones** currently revealed | Advance turn. |
| `SKIP_TURN` | status='active', names current holder | Disconnect: drop streak, mark player absent, advance (future turns bypass them). |
| `MARK_PRESENT` | — | Reconnect: clear the absent flag. No-op if not absent. |
| `TIMEOUT_TURN` | status='active', names current holder | Shot clock expired: bank a standing streak else pass with 0, advance. Never marks absent. |

## What the engine does NOT know about

- **Time.** No turn timers, no disconnect timeouts.
- **Network.** No idea what mode (local/online) is calling it.
- **Persistence.** No DB hooks. Caller stores the state.
- **UI.** No animations, no "show this card for 2 seconds before clearing."

Those concerns live in `src/client/` (browser) or `src/server/` (server actions + DB).

## Testing

Always co-located: `*.test.ts` next to source. Run via `npm run test:run`. Cover the action matrix from `.claude/docs/game-rules.md` — invalid paths included.

## Editing this directory

- Never import from `react`, `next`, `@supabase/*`, or anything in `src/client/` or `src/server/`. If you find yourself wanting to, the logic doesn't belong here.
- Adding a new action: add to `GameAction` union, add a case to `reduce`, write tests for valid + invalid paths.
- Adding a new deck variant: add to `DeckVariant`, populate `DECKS`, add to `DECK_VARIANTS`. No engine changes needed.
