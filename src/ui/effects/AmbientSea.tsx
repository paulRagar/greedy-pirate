/**
 * Ambient parallax seascape — two wave bands drifting at different speeds
 * plus a distant ship sailing the horizon. Pure CSS (transform/opacity
 * only), server component, sits between the body gradients and content.
 */
export function AmbientSea() {
   return (
      <div className='pointer-events-none fixed inset-0 -z-10 overflow-hidden' aria-hidden='true'>
         {/* Distant ship — outer div sails, inner div bobs */}
         <div className='animate-ship-sail absolute bottom-[11vh] left-0'>
            <div className='animate-hero-bob'>
               <ShipSilhouette className='h-10 w-14 opacity-40' />
            </div>
         </div>

         {/* Far wave band — slow */}
         <div className='animate-wave absolute bottom-0 left-0 h-[12vh] w-[200%] opacity-[0.07]' style={{ animationDuration: '48s' }}>
            <WaveBand fill='var(--color-teal-500)' />
         </div>

         {/* Near wave band — faster, deeper */}
         <div className='animate-wave absolute -bottom-[2vh] left-0 h-[10vh] w-[200%] opacity-[0.12]' style={{ animationDuration: '26s' }}>
            <WaveBand fill='var(--color-deep-500)' />
         </div>
      </div>
   );
}

function WaveBand({ fill }: { fill: string }) {
   // One sine period per 360 units, repeated so translateX(-50%) loops seamlessly.
   return (
      <svg viewBox='0 0 1440 100' preserveAspectRatio='none' className='h-full w-full'>
         <path
            d='M0 40 C60 20 120 20 180 40 C240 60 300 60 360 40 C420 20 480 20 540 40 C600 60 660 60 720 40 C780 20 840 20 900 40 C960 60 1020 60 1080 40 C1140 20 1200 20 1260 40 C1320 60 1380 60 1440 40 L1440 100 L0 100 Z'
            fill={fill}
         />
      </svg>
   );
}

function ShipSilhouette({ className }: { className?: string }) {
   return (
      <svg viewBox='0 0 56 40' className={className}>
         {/* hull */}
         <path d='M4 30 L52 30 L46 38 L10 38 Z' fill='var(--color-abyss-800)' />
         {/* mast + sails */}
         <rect x='26' y='6' width='2' height='24' fill='var(--color-abyss-800)' />
         <path d='M28 8 L44 24 L28 24 Z' fill='var(--color-abyss-800)' />
         <path d='M26 11 L14 24 L26 24 Z' fill='var(--color-abyss-800)' opacity='0.85' />
         {/* lantern */}
         <circle cx='49' cy='28' r='1.5' fill='var(--color-gold-400)' opacity='0.9' />
      </svg>
   );
}
