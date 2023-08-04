import './globals.css';

export const metadata = {
   title: 'Nut Nut Squirrel',
   description: 'Browser based version of the popular card game, Nut Nut Squirrel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
   return (
      <html lang='en'>
         <body>
            <div className='h-screen w-screen p-4 bg-gray-200 bg'>{children}</div>
         </body>
      </html>
   );
}
