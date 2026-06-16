'use client';

import { PirateLinkButton } from '@/ui/pirate-button/PirateLinkButton';

export default function NotFound() {
   return (
      <main className='scrollbar-none flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-5 py-10 text-center safe-bottom'>
         <div className='pirate-display text-7xl text-[color:var(--color-treasure-400)]'>404</div>
         <h1 className='pirate-display text-3xl text-[color:var(--color-cream-100)]'>
            Arrr, yer map&apos;s led ye astray!
         </h1>
         <p className='max-w-md text-sm text-[color:var(--color-cream-200)]/75'>
            This page be buried deep, or it never existed. Navigate yerself back to safer waters.
         </p>
         <PirateLinkButton href='/' variant='primary' size='md'>
            Sail Home
         </PirateLinkButton>
      </main>
   );
}
