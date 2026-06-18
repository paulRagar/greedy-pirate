import type { Metadata } from 'next';
import JoinClient from './JoinClient';

export const metadata: Metadata = {
   title: 'Join a Greedy Pirate Room',
   description:
      'Enter a 4-character room code to join a friend’s online Greedy Pirate game. Free, no install required.',
   alternates: { canonical: 'https://greedypirate.com/play/join' },
};

export const dynamic = 'force-dynamic';

export default function PlayJoinPage() {
   return <JoinClient />;
}
