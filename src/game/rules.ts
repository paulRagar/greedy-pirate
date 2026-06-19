import type { DeckVariant } from './types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

export const DECK_VARIANTS = ['greedy', 'even_greedier', 'super_greedy'] as const satisfies readonly DeckVariant[];

export const DEFAULT_VARIANT: DeckVariant = 'even_greedier';

/**
 * Per-turn shot clock for online play, in milliseconds. A pacing constant
 * consumed by the server (stamps the absolute `turn_deadline` after every
 * turn-advancing action) and the client (renders the countdown + fires the
 * auto-resolve). The pure engine never reads it — it knows nothing of time.
 */
export const TURN_CLOCK_MS = 12_000;

/**
 * Shortened shot clock applied while a pirate is revealed online. There's no
 * decision to make once you're robbed, so the turn auto-passes after a brief
 * beat (shake + vignette) instead of waiting on a tap. Server stamps it as the
 * turn deadline; the client uses it as the countdown total when a pirate shows.
 */
export const PIRATE_PASS_MS = 2_000;
