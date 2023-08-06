'use client';
import './globals.css';
import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import ThemeToggle from '@/components/theme-toggle/ThemeToggle';

const description = `Embark on a thrilling voyage with 'Greedy Pirate', where a treasure of coins awaits, but beware - one wrong card could plunder your loot in this high-stakes, risk-and-reward browser card game!`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
   useEffect(() => {
      if (!localStorage.theme) localStorage.setItem('theme', 'light');

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
         </head>
         <body>
            <div className='h-screen w-screen p-4 bg-gray-200 dark:bg-slate-900'>{children}</div>
            <Analytics />
            <ThemeToggle />
         </body>
      </html>
   );
}
