import type { Metadata } from 'next';
import ChooseGameClient from './ChooseGameClient';

export const metadata: Metadata = {
   title: 'Play Greedy Pirate — Local or Online',
   description:
      'Start a Greedy Pirate game. Pass-and-play locally with friends on one device, or create / join an online room with a 4-character code.',
   alternates: { canonical: 'https://greedypirate.com/choose-game' },
};

type Props = {};

const ChooseGame = ({}: Props) => {
   return <ChooseGameClient />;
};

export default ChooseGame;
