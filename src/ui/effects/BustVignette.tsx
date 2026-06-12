'use client';

/**
 * Blood-red screen-edge vignette that flashes in when a pirate is drawn.
 * Render conditionally (only while the pirate card is showing); the
 * bust-flash animation punches in then settles to a simmer.
 */
export function BustVignette() {
   return (
      <div
         className='bust-vignette animate-bust-flash pointer-events-none fixed inset-0 z-30'
         aria-hidden='true'
      />
   );
}
