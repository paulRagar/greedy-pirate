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
