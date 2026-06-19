# Game Rules & State Machine

## Premise

Players take turns drawing cards from a shared, shuffled deck. Each card is either **gold** (a positive integer value) or **pirate**. Gold cards add to your current-turn streak. A pirate ends your turn and wipes your streak. At any time before drawing a pirate, you can **bank** your streak, adding it to your safe coin total. When the deck is empty, the player with the most coins wins.

## Players

- Minimum: 2
- Maximum: 10
- Turn order: fixed by seat (the order players were added during setup).

## Turn structure

On their turn, a player can:

1. **Plunder** (draw the top card).
   - If gold (value ≥ 1): added to current streak. Player may continue or bank.
   - If pirate: streak wiped, turn ends.
2. **Bury It** (bank the streak).
   - All gold cards in the streak are added to the player's `coins`. Streak clears. Turn ends.
3. **Skip** is not allowed — once a turn begins, the player must either draw at least once or bank if they have a streak.

After turn ends, play passes clockwise (next seat). When the deck is empty after a final draw, the game ends immediately.

## Banking ends turn

Banking does NOT let you keep drawing on the same turn. It commits and passes the turn. The choice each round is: keep drawing, or bank-and-pass.

## Last card edge case

If the last card drawn is gold, it counts toward the active player's streak AND the game ends — the streak is auto-banked. If the last card is a pirate, the active player loses their streak and the game ends.

## Deck variants

Defined as data in `src/game/deck.ts`. Three variants:

| Variant | Cards | Pirate ratio | Gold values |
|---|---|---|---|
| `greedy` | 47 | 10 pirates / 37 gold | All 1s |
| `even_greedier` | 47 | 10 pirates / 37 gold | Mix of 1–5 |
| `super_greedy` | 98 | 15 pirates / 83 gold | Mix of 1–10 |

**Default:** `even_greedier`. `DEFAULT_VARIANT` in `src/game/rules.ts` controls this. The variant picker is intentionally hidden from the setup UI — users start games without thinking about it. Variants are reachable via the `?variant=` query string for future expansion / direct linking.

## Winning

Highest `coins` when the deck empties. Ties broken by:
1. Highest single banked streak (`max_single_bank`) — _now tracked per-player as `GameState.telemetry[id].biggestBank` (GRE-26); not yet wired into the winner sort._
2. Fewest pirates encountered — _now tracked per-player as `GameState.telemetry[id].piratesEncountered` (GRE-26); not yet wired into the winner sort._
3. Coin flip (random tiebreaker, persisted in `game_events`) — _not yet implemented._

Current tie behavior: lexicographic by `coins` then whoever sort happens to land first. Acceptable for MVP.

### Per-player telemetry (GRE-26)

The engine accrues `GameState.telemetry`, a `Record<playerId, { maxStreakLength, biggestBank, piratesEncountered }>`, updated in the DRAW/BANK reducers and reset on `START_GAME`. It is **server/internal only** — `toPublic()` does not expose it. At **online** game completion the server rolls it into `user_stats` (`longest_streak_value`, `biggest_single_bank`, `total_pirates_encountered`) and into the per-seat `game_players.pirates_encountered`, then unlocks achievements and notifies each player via the completion broadcast's `unlocks` map. `maxStreakLength` is the high-water mark of consecutive gold held (counts even if the run later busts). Local games run the same engine (so the telemetry exists) but intentionally do not persist stats or achievements.

## End-of-game UI

The completion modal leads with the winner's name (`{winner.name} wins!`) and renders a single ordered list `1..N` showing every player, with the winner highlighted gold and `(you)` labels for the local viewer. Online mode shares the same shape.

---

## State machine

```
       ┌─────────────┐
       │   LOBBY     │  (online only — local skips this)
       └──────┬──────┘
              │ start
              ▼
       ┌─────────────┐  draw (gold)
   ┌──▶│ TURN_ACTIVE │──────────┐
   │   └──────┬──────┘          │
   │          │                 │
   │ bank     │ draw (pirate)   │
   │          ▼                 │
   │   ┌─────────────┐          │
   │   │ TURN_ENDED  │ ◀────────┘
   │   └──────┬──────┘
   │          │ advance turn
   │          ▼
   └──────────┘

   (when deck empties after final draw → COMPLETE)
```

### Engine contract

```ts
type GameState = {
   status: 'lobby' | 'active' | 'complete';
   players: Player[];              // ordered by seat
   turnIndex: number;
   deck: Card[];                   // remaining
   currentCard: Card | null;       // just-revealed card
   currentStreak: GoldCard[];      // gold cards in this turn's streak
   pirateCount: number;            // total pirates revealed
   variant: DeckVariant;
   winnerId: string | null;
};

type GameAction =
   | { type: 'DRAW' }
   | { type: 'BANK' }
   | { type: 'END_TURN' }
   | { type: 'START_GAME'; seed: string; variant?: DeckVariant }
   | { type: 'PLAYER_JOIN'; player: PlayerInit }
   | { type: 'PLAYER_LEAVE'; playerId: string }
   | { type: 'SKIP_TURN'; playerId: string }      // disconnect: skip + mark absent
   | { type: 'MARK_PRESENT'; playerId: string }   // reconnect: clear absent flag
   | { type: 'TIMEOUT_TURN'; playerId: string };  // shot clock: auto-resolve, stay present

function reduce(state: GameState, action: GameAction): GameState;
```

**Rules of the engine:**

1. `reduce` is pure. Same input → same output. No `Date.now()`, no `Math.random()` outside of a passed-in seeded RNG.
2. Invalid actions throw `EngineError` (e.g., `BANK` with empty streak, `DRAW` on completed game). Caller validates before dispatching.
3. The engine doesn't know about turns expiring, players disconnecting, or any clock. Those are the server's concern.
4. Shuffling: takes a seeded PRNG (mulberry32 in `src/game/shuffle.ts`) so we can replay deterministically. Server stores the seed via `START_GAME`'s `seed` field.
5. Caller supplies the seed. Local uses `crypto.randomUUID()`. Server uses the same; persists in the action history via `game_events.payload`.

### Why an explicit `END_TURN` after a pirate?

A pirate ends the streak but we want a beat — the UI shows the pirate card, animates the shake, and the player taps "Pass the Helm" to advance. Explicit dispatch keeps the UI from racing the state.

Alternative: have `DRAW` (when it reveals a pirate) auto-advance. We chose the explicit version for UI clarity.

### Turn shot clock (online)

Online turns carry a server-stamped `turn_deadline` (`TURN_CLOCK_MS`, 12s), reset on every turn advance and on each `DRAW`. The engine stays time-free — the deadline lives on the `games` row, rides each broadcast, and clients render the countdown. At expiry a designated client fires `TIMEOUT_TURN` and the server (after re-checking the deadline against the locked row, so a turn can't be cut short early) auto-resolves it: a standing streak is banked, otherwise the turn passes with no coins. `TIMEOUT_TURN` never marks the player absent — a slow-but-connected player keeps their seat and gets a fresh clock next turn. Contrast `SKIP_TURN`, fired only when a player truly disconnects, which *does* flag them absent so future turns bypass their seat until they reconnect (`MARK_PRESENT`).

---

## Public state for online mode

The server never sends `deck` to clients. It broadcasts `PublicGameState` (defined in `src/game/public.ts`):

```ts
type PublicGameState = {
   status: GameStatus;
   players: PublicPlayer[];         // {id, name, coins}
   turnIndex: number;
   currentCard: Card | null;
   currentStreak: GoldCard[];
   pirateCount: number;
   variant: DeckVariant;
   winnerId: string | null;
   deckCount: number;               // length, not contents
};
```

Clients reduce a small subset of actions optimistically (BANK, END_TURN) since they're derivable from public state. DRAW shows a loader because the next card is unknown until the server reveals it.

---

## Edge cases the engine MUST handle

- Draw on empty deck → throw.
- Draw when `status === 'lobby'` or `'complete'` → throw.
- Bank with empty streak → throw.
- Bank after pirate revealed → throw (must `END_TURN` first).
- Last card is gold → auto-bank, transition to `'complete'`.
- Last card is pirate → no bank (streak lost), transition to `'complete'`.
- One player tries to start a game alone → engine doesn't enforce min players; the server layer (`startOnlineGame`) does.

---

## Tests

In `src/game/engine.test.ts` (21 tests, all passing):

```
✓ PLAYER_JOIN adds players with zero coins
✓ PLAYER_JOIN rejects duplicate ids
✓ PLAYER_JOIN rejects when lobby full
✓ PLAYER_JOIN rejects after game started
✓ START_GAME requires minimum players
✓ START_GAME produces deterministic deck given same seed
✓ START_GAME produces different deck given different seed
✓ START_GAME transitions status to active with full deck
✓ DRAW gold appends to streak, keeps turn
✓ DRAW pirate clears streak, increments pirateCount; turn stays
✓ Rejects DRAW while pirate revealed
✓ BANK adds streak sum to current player and advances turn
✓ BANK rejects with empty streak
✓ BANK rejects after pirate revealed
✓ END_TURN advances turn after pirate
✓ END_TURN rejects without pirate
✓ Last gold draw auto-banks and completes
✓ Winner is highest coins
✓ Rejects DRAW after completion
✓ reduce does not mutate input state
✓ same seed + actions → identical final states
```
