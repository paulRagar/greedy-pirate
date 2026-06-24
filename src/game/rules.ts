import type { DeckVariant } from './types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

export const DECK_VARIANTS = ['greedy', 'even_greedier', 'super_greedy', 'cursed'] as const satisfies readonly DeckVariant[];

export const DEFAULT_VARIANT: DeckVariant = 'even_greedier';

// ── Cursed Seas special-card tuning ──────────────────────────────────────────
/** Cursed Doubloon: gold cards doubled (and bank locked) for this many draws. */
export const MULTIPLIER_WINDOW = 3;
/** Cursed Doubloon: gold value multiplier during the window. */
export const MULTIPLIER_FACTOR = 2;
/** Spyglass: how many upcoming cards the drawer privately sees. */
export const SPYGLASS_PEEK = 3;
/** Davey Jones: forced bank wager (or the whole bank if it holds less). */
export const DAVEY_WAGER = 5;

/**
 * Per-turn shot clock for online play, in milliseconds. A pacing constant
 * consumed by the server (stamps the absolute `turn_deadline` after every
 * turn-advancing action) and the client (renders the countdown + fires the
 * auto-resolve). The pure engine never reads it — it knows nothing of time.
 */
export const TURN_CLOCK_MS = 10_000;

/**
 * Length of the "helm passes to X" hand-off beat online. Used two ways: as the
 * shortened turn deadline while a pirate is revealed (no decision once you're
 * robbed), and as the brief pause shown after the shot clock expires before the
 * turn actually advances — so a pirate pass and a timeout forfeit feel the same.
 */
export const PIRATE_PASS_MS = 1_500;

/**
 * Boarding countdown for online lobby start. When the host hits start with the
 * crew not all ready, stragglers get this long to ready up before unready
 * seats are dropped and the game sails. Skipped entirely when everyone's ready.
 */
export const BOARDING_COUNTDOWN_MS = 20_000;
