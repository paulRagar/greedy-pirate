import PlayLocalClient from './PlayLocalClient';

interface Props {
   searchParams?: {
      deckConfig: string;
      showDeck: string;
   };
}

const PlayLocal = async ({ searchParams }: Props) => {
   const deckConfig = searchParams?.deckConfig || undefined;
   const showDeck = searchParams?.showDeck?.toLocaleLowerCase() === 'true';
   return <PlayLocalClient deckConfig={deckConfig} showDeck={showDeck} />;
};

export default PlayLocal;
