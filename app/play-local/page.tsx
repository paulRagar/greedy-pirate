import PlayLocalClient from './PlayLocalClient';

interface Props {
   searchParams?: {
      evenGreedier: string;
      showDeck: string;
   };
}

const PlayLocal = async ({ searchParams }: Props) => {
   const evenGreedier = searchParams?.evenGreedier?.toLocaleLowerCase() === 'true';
   const showDeck = searchParams?.showDeck?.toLocaleLowerCase() === 'true';
   return <PlayLocalClient evenGreedier={evenGreedier} showDeck={showDeck} />;
};

export default PlayLocal;
