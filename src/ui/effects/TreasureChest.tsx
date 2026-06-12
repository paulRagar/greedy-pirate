import { cn } from '@/lib/cn';

/** Open treasure chest with spilling coins — victory trophy + bank burst art. */
export function TreasureChest({ className }: { className?: string }) {
   return (
      <svg viewBox='0 0 96 96' className={cn('animate-glow-pulse', className)} aria-hidden='true'>
         <defs>
            <linearGradient id='vm-lid' x1='0' y1='0' x2='0' y2='1'>
               <stop offset='0%' stopColor='var(--color-wood-500)' />
               <stop offset='100%' stopColor='var(--color-wood-700)' />
            </linearGradient>
            <radialGradient id='vm-burst' cx='50%' cy='45%' r='55%'>
               <stop offset='0%' stopColor='rgb(255 217 102 / 0.7)' />
               <stop offset='100%' stopColor='transparent' />
            </radialGradient>
         </defs>
         {/* light burst */}
         <circle cx='48' cy='42' r='40' fill='url(#vm-burst)' />
         {/* coins spilling */}
         <g fill='var(--color-gold-400)' stroke='var(--color-gold-600)' strokeWidth='1'>
            <circle cx='30' cy='38' r='5' />
            <circle cx='48' cy='32' r='6' />
            <circle cx='66' cy='38' r='5' />
            <circle cx='39' cy='34' r='4.5' />
            <circle cx='57' cy='34' r='4.5' />
         </g>
         {/* chest base */}
         <rect x='18' y='44' width='60' height='34' rx='5' fill='url(#vm-lid)' stroke='var(--color-wood-900)' strokeWidth='2' />
         {/* open lid */}
         <path d='M18 46 C18 30 78 30 78 46 L78 50 L18 50 Z' fill='var(--color-wood-600)' stroke='var(--color-wood-900)' strokeWidth='2' />
         {/* gold bands */}
         <rect x='18' y='52' width='60' height='5' fill='var(--color-gold-500)' />
         <rect x='43' y='44' width='10' height='34' fill='var(--color-gold-500)' stroke='var(--color-wood-900)' strokeWidth='1.4' />
         {/* lock */}
         <circle cx='48' cy='62' r='5.5' fill='var(--color-gold-300)' stroke='var(--color-wood-900)' strokeWidth='1.4' />
         {/* sparkles */}
         <g fill='var(--color-cream-100)'>
            <path d='M22 22 L24 27 L29 29 L24 31 L22 36 L20 31 L15 29 L20 27 Z' />
            <path d='M74 18 L75.5 22 L79.5 23.5 L75.5 25 L74 29 L72.5 25 L68.5 23.5 L72.5 22 Z' opacity='0.9' />
         </g>
      </svg>
   );
}
