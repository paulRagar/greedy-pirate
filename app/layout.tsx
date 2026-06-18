import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { AuthBootstrap } from '@/client/auth/AuthBootstrap';
import { RecoveryHashRouter } from '@/client/auth/RecoveryHashRouter';
import { AmbientSea } from '@/ui/effects/AmbientSea';
import { TopNav } from '@/ui/top-nav/TopNav';

export const viewport: Viewport = {
   width: 'device-width',
   initialScale: 1,
   maximumScale: 1,
   themeColor: '#02060f',
   viewportFit: 'cover',
   interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
   metadataBase: new URL('https://greedypirate.com'),
   title: 'Greedy Pirate',
   description:
      'Embark on a thrilling voyage with Greedy Pirate, where a treasure of coins awaits, but beware - one wrong card could plunder your loot in this high-stakes, risk-and-reward browser card game!',
   keywords: [
      'greedy pirate',
      'card game',
      'pirate card game',
      'treasure collecting game',
      'risk-reward game',
      'strategy card game',
      'multiplayer card game',
      'family game',
      'bank or bust',
   ],
   icons: { icon: '/assets/favicon-greedy-pirate.png' },
   alternates: { canonical: 'https://greedypirate.com' },
   openGraph: {
      title: 'Greedy Pirate — push-your-luck pirate card game',
      description:
         'Embark on a thrilling voyage with Greedy Pirate, where a treasure of coins awaits, but beware - one wrong card could plunder your loot in this high-stakes, risk-and-reward browser card game!',
      url: 'https://greedypirate.com',
      siteName: 'Greedy Pirate',
      type: 'website',
      locale: 'en_US',
   },
   twitter: {
      card: 'summary_large_image',
      title: 'Greedy Pirate — push-your-luck pirate card game',
      description:
         'Draw gold, bank your loot, beware the pirates. Free browser card game for 2–10 players. Pass-and-play or online rooms.',
   },
   appleWebApp: {
      capable: true,
      title: 'Greedy Pirate',
      statusBarStyle: 'black-translucent',
   },
   formatDetection: { telephone: false },
};

const STRUCTURED_DATA = {
   '@context': 'https://schema.org',
   '@graph': [
      {
         '@type': 'WebSite',
         '@id': 'https://greedypirate.com/#website',
         url: 'https://greedypirate.com',
         name: 'Greedy Pirate',
         description:
            'Free browser-based push-your-luck pirate card game for 2–10 players. Pass-and-play locally or join online rooms with a 4-character code.',
         inLanguage: 'en',
      },
      {
         '@type': 'VideoGame',
         '@id': 'https://greedypirate.com/#game',
         name: 'Greedy Pirate',
         url: 'https://greedypirate.com',
         description:
            'A risk-and-reward card game. Players draw from a shuffled deck of gold and pirate cards. Build a streak, bank your loot, or push your luck and lose it all to a pirate. Highest coin total when the deck runs out wins.',
         genre: ['Push-your-luck', 'Card game', 'Party game', 'Multiplayer'],
         gamePlatform: ['Web browser', 'iOS Safari', 'Android Chrome'],
         applicationCategory: 'Game',
         operatingSystem: 'Any',
         numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 10 },
         playMode: ['MultiPlayer', 'CoOp'],
         offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
   ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
   return (
      <html lang='en' className='dark' suppressHydrationWarning>
         <body>
            <script
               type='application/ld+json'
               dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
            />
            <AmbientSea />
            <AuthBootstrap>
               <RecoveryHashRouter />
               {/* Fixed app shell: exactly one viewport tall, no document scroll.
                   Screens that need scrolling (profile) opt in with overflow-y-auto
                   on their own <main> and handle their own bottom safe inset. */}
               {/* No top padding here — TopNav carries the safe-area inset so the
                   home hero (which has no nav) can run flush to the screen top. */}
               <div className='mx-auto flex h-dvh w-full max-w-3xl flex-col overflow-hidden'>
                  <TopNav />
                  {children}
               </div>
            </AuthBootstrap>
            <Analytics />
         </body>
      </html>
   );
}
