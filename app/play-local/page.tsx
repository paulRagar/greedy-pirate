import PlayLocalClient from './PlayLocalClient';
import { DEFAULT_VARIANT } from '@/game/rules';
import type { DeckVariant } from '@/game/types';

type SearchParams = Promise<{
   variant?: string;
   evenGreedier?: string;
}>;

const VALID_VARIANTS: ReadonlyArray<DeckVariant> = ['greedy', 'even_greedier', 'super_greedy'];

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
