import PlayLocalClient from './PlayLocalClient';

interface Props {
   searchParams?: { showDeck: string };
}

const PlayLocal = async ({ searchParams }: Props) => {
   const showDeck = searchParams?.showDeck?.toLocaleLowerCase() === 'true';
   return <PlayLocalClient showDeck={showDeck} />;
};

export default PlayLocal;
