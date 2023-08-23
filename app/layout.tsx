'use client';
import './globals.css';
import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
   useEffect(() => {
      if (!localStorage.theme) localStorage.setItem('theme', 'dark');

      if (
         localStorage.theme === 'dark' ||
         (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ) {
         document.documentElement.classList.remove('light');
         document.documentElement.classList.add('dark');
      } else {
         document.documentElement.classList.remove('dark');
         document.documentElement.classList.add('light');
      }
   }, []);

   return (
      <html lang='en'>
         <head>
            <title>Greedy Pirate</title>
            <link rel='icon' href='/assets/favicon-greedy-pirate.png' />
            <meta
               name='description'
               content='Embark on a thrilling voyage with Greedy Pirate, where a treasure of coins awaits, but beware - one wrong card could plunder your loot in this high-stakes, risk-and-reward browser card game!'
            />
            <meta
               name='keywords'
               content='greedy, pirate,Greedy Pirate, Card game, Pirate card game, Treasure collecting game, Risk-reward game, Strategy card game, Coin collecting game, Draw and bank game, Pirate-themed game, Family game, Board game night, Fun card games, Card game with coins, Card banking game, Avoid the pirate card, Treasure card game, Multiplayer card game, Tabletop pirate game, Greedy Pirate rules, Card game strategies, Pirate treasure hunt game, Game of luck and strategy, Streak based card game, Family game night ideas, Games like Greedy Pirate, Card draw strategy, Pirate coin game, Bank or bust game, Easy to learn card games, Competitive card games'
            />
            <meta property='og:title' content='Greedy Pirate' />
            <meta
               property='og:description'
               content='Embark on a thrilling voyage with Greedy Pirate, where a treasure of coins awaits, but beware - one wrong card could plunder your loot in this high-stakes, risk-and-reward browser card game!'
            />
            <meta property='og:image' content='/assets/open-graph-image.svg' />
            <meta property='og:url' content='https://greedypirate.com' />
            <link rel='canonical' href='https://greedypirate.com' />
         </head>
         <body>
            <div className='h-screen w-screen max-w-[1460px] m-auto p-4 bg-gray-200 dark:bg-slate-900'>{children}</div>
            <Analytics />
         </body>
      </html>
   );
}
