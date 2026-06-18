import type { Metadata } from 'next';
import SetupClient from './SetupClient';

export const metadata: Metadata = {
   title: 'Set Up a Greedy Pirate Game',
   description: 'Add 2–10 players and start a Greedy Pirate match.',
   alternates: { canonical: 'https://greedypirate.com/setup' },
};

type Props = {};

const Setup = ({}: Props) => {
   return <SetupClient />;
};

export default Setup;
