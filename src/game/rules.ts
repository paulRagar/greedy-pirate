import type { DeckVariant } from './types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

export const DECK_VARIANTS = ['greedy', 'even_greedier', 'super_greedy'] as const satisfies readonly DeckVariant[];

export const DEFAULT_VARIANT: DeckVariant = 'even_greedier';
