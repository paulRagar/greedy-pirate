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

   useEffect(() => {
      window.addEventListener('load', function () {
         setTimeout(function () {
            // This helps to hide the address bar
            window.scrollTo(0, 1);
         }, 0);
      });

      document?.documentElement?.requestFullscreen && document.documentElement.requestFullscreen();
   }, []);

   return (
      <html lang='en'>
         <head>
            <title>Greedy Pirate</title>
            <meta
               name='viewport'
               content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
            />
         </head>
         <body>
            <div className='h-screen w-screen max-w-[1460px] m-auto p-4 bg-gray-200 dark:bg-slate-900'>{children}</div>
            <Analytics />
         </body>
      </html>
   );
}
