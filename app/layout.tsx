import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { AuthBootstrap } from '@/client/auth/AuthBootstrap';
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
      title: 'Greedy Pirate',
      description:
         'Embark on a thrilling voyage with Greedy Pirate, where a treasure of coins awaits, but beware - one wrong card could plunder your loot in this high-stakes, risk-and-reward browser card game!',
      url: 'https://greedypirate.com',
      images: ['/assets/open-graph-image.svg'],
   },
   appleWebApp: {
      capable: true,
      title: 'Greedy Pirate',
      statusBarStyle: 'black-translucent',
   },
   formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
   return (
      <html lang='en' className='dark' suppressHydrationWarning>
         <body>
            <AmbientSea />
            <AuthBootstrap>
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
