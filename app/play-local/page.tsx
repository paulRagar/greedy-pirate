import type { Metadata } from 'next';
import PlayLocalClient from './PlayLocalClient';
import { DEFAULT_VARIANT } from '@/game/rules';
import type { DeckVariant } from '@/game/types';

export const metadata: Metadata = {
   title: 'Play Greedy Pirate Locally — Pass-and-Play for 2–10',
   description:
      'Play Greedy Pirate on one device with 2–10 friends. No signup, no install. Pure push-your-luck card game in your browser.',
   alternates: { canonical: 'https://greedypirate.com/play-local' },
};

type SearchParams = Promise<{
   variant?: string;
   evenGreedier?: string;
}>;

const VALID_VARIANTS: ReadonlyArray<DeckVariant> = ['greedy', 'even_greedier', 'super_greedy', 'cursed'];

function resolveVariant(params: Awaited<SearchParams>): DeckVariant {
   if (params.variant && (VALID_VARIANTS as readonly string[]).includes(params.variant)) {
      return params.variant as DeckVariant;
   }
   if (params.evenGreedier?.toLowerCase() === 'true') {
      return 'super_greedy';
   }
   return DEFAULT_VARIANT;
}

const PlayLocal = async ({ searchParams }: { searchParams: SearchParams }) => {
   const params = await searchParams;
   return <PlayLocalClient variant={resolveVariant(params)} />;
};

export default PlayLocal;
