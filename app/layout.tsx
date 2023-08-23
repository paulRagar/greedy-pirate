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
         </head>
         <body>
            <div className='h-screen w-screen max-w-[1460px] m-auto p-4 bg-gray-200 dark:bg-slate-900'>{children}</div>
            <Analytics />
         </body>
      </html>
   );
}
