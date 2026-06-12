import { cn } from '@/lib/cn';
import type { Card as GameCard } from '@/game/types';

interface Props {
   card: GameCard | null;
   className?: string;
}

export function PirateCard({ card, className }: Props) {
   const isPirate = card?.kind === 'pirate';

   return (
      <div
         className={cn(
            // Height-driven so the card flexes with leftover viewport space.
            // Width-only would reflow; constraining both axes drops aspect-ratio.
            'card-flip-container aspect-[3/4] h-full max-h-[346px]',
            isPirate && 'animate-bust-shake',
            className,
         )}
      >
         <div className={cn('relative h-full w-full card-flip', card ? 'is-flipped' : '')}>
            <CardBack className='card-face absolute inset-0' />
            <CardFront className='card-face card-face-back absolute inset-0' card={card} />
         </div>
      </div>
   );
}

/* ────────────────────────── Card back ────────────────────────── */

function CardBack({ className }: { className?: string }) {
   return (
      <div
         className={cn(
            'overflow-hidden rounded-2xl border-2 border-[color:var(--color-gold-600)]/80 card-shadow',
            className,
         )}
      >
         <svg viewBox='0 0 240 320' className='h-full w-full' aria-hidden='true'>
            <defs>
               <linearGradient id='gpback-felt' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='var(--color-deep-600)' />
                  <stop offset='55%' stopColor='var(--color-deep-800)' />
                  <stop offset='100%' stopColor='var(--color-abyss-900)' />
               </linearGradient>
               <radialGradient id='gpback-glow' cx='50%' cy='42%' r='60%'>
                  <stop offset='0%' stopColor='rgb(94 234 212 / 0.22)' />
                  <stop offset='100%' stopColor='transparent' />
               </radialGradient>
               <linearGradient id='gpback-gold' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='var(--color-gold-200)' />
                  <stop offset='50%' stopColor='var(--color-gold-400)' />
                  <stop offset='100%' stopColor='var(--color-gold-600)' />
               </linearGradient>
            </defs>

            {/* Felt base + lagoon glow */}
            <rect width='240' height='320' fill='url(#gpback-felt)' />
            <rect width='240' height='320' fill='url(#gpback-glow)' />

            {/* Diamond lattice */}
            <g stroke='rgb(94 234 212 / 0.1)' strokeWidth='1'>
               {Array.from({ length: 11 }).map((_, i) => (
                  <line key={`a${i}`} x1={-80 + i * 40} y1='0' x2={40 + i * 40} y2='320' />
               ))}
               {Array.from({ length: 11 }).map((_, i) => (
                  <line key={`b${i}`} x1={40 + i * 40} y1='0' x2={-80 + i * 40} y2='320' />
               ))}
            </g>

            {/* Double gold frame */}
            <rect x='10' y='10' width='220' height='300' rx='12' fill='none' stroke='url(#gpback-gold)' strokeWidth='2.5' />
            <rect x='17' y='17' width='206' height='286' rx='8' fill='none' stroke='var(--color-gold-500)' strokeWidth='1' opacity='0.55' strokeDasharray='1 4' strokeLinecap='round' />

            {/* Corner flourishes */}
            {[
               'translate(22,22)',
               'translate(218,22) scale(-1,1)',
               'translate(22,298) scale(1,-1)',
               'translate(218,298) scale(-1,-1)',
            ].map((t, i) => (
               <g key={i} transform={t} fill='none' stroke='var(--color-gold-400)' strokeWidth='2' strokeLinecap='round' opacity='0.9'>
                  <path d='M0 14 Q0 0 14 0' />
                  <path d='M4 22 Q4 4 22 4' opacity='0.5' />
                  <circle cx='9' cy='9' r='2' fill='var(--color-coral-500)' stroke='none' />
               </g>
            ))}

            {/* Center medallion — compass ring + skull */}
            <g transform='translate(120,148)'>
               <circle r='62' fill='var(--color-abyss-900)' stroke='url(#gpback-gold)' strokeWidth='3' />
               <circle r='54' fill='none' stroke='var(--color-teal-500)' strokeWidth='1' opacity='0.45' strokeDasharray='3 5' />
               {/* compass points */}
               {[0, 90, 180, 270].map((a) => (
                  <path key={a} d='M0 -54 L5 -38 L0 -33 L-5 -38 Z' fill='var(--color-gold-400)' transform={`rotate(${a})`} />
               ))}
               {[45, 135, 225, 315].map((a) => (
                  <path key={a} d='M0 -50 L3 -40 L0 -36 L-3 -40 Z' fill='var(--color-teal-400)' opacity='0.7' transform={`rotate(${a})`} />
               ))}
               {/* skull */}
               <g fill='var(--color-cream-100)'>
                  <path d='M0 -26 C-17 -26 -28 -14 -28 1 C-28 10 -23 17 -16 21 L-16 27 C-16 30 -14 32 -11 32 L11 32 C14 32 16 30 16 27 L16 21 C23 17 28 10 28 1 C28 -14 17 -26 0 -26 Z' />
               </g>
               {/* bandana on skull */}
               <path d='M-27 -7 C-24 -22 -13 -29 0 -29 C13 -29 24 -22 27 -7 C18 -13 9 -15 0 -15 C-9 -15 -18 -13 -27 -7 Z' fill='var(--color-coral-500)' />
               <circle cx='-9' cy='-21' r='1.8' fill='var(--color-gold-300)' />
               <circle cx='3' cy='-23' r='1.8' fill='var(--color-gold-300)' />
               <circle cx='14' cy='-19' r='1.8' fill='var(--color-gold-300)' />
               {/* eyes + nose + grin */}
               <circle cx='-10' cy='4' r='6' fill='var(--color-abyss-950)' />
               <circle cx='10' cy='4' r='6' fill='var(--color-abyss-950)' />
               <circle cx='-8.5' cy='2.5' r='1.6' fill='var(--color-teal-400)' />
               <circle cx='11.5' cy='2.5' r='1.6' fill='var(--color-teal-400)' />
               <path d='M0 12 L4 18 L-4 18 Z' fill='var(--color-abyss-950)' />
               <g stroke='var(--color-abyss-950)' strokeWidth='1.6'>
                  <line x1='-7' y1='24' x2='-7' y2='30' />
                  <line x1='0' y1='25' x2='0' y2='31' />
                  <line x1='7' y1='24' x2='7' y2='30' />
               </g>
               {/* crossed swords behind */}
               <g stroke='var(--color-gold-400)' strokeWidth='3.5' strokeLinecap='round' opacity='0.9'>
                  <line x1='-46' y1='40' x2='-22' y2='22' />
                  <line x1='46' y1='40' x2='22' y2='22' />
               </g>
               <g stroke='var(--color-wood-600)' strokeWidth='5' strokeLinecap='round'>
                  <line x1='-50' y1='43' x2='-44' y2='38.5' />
                  <line x1='50' y1='43' x2='44' y2='38.5' />
               </g>
            </g>

            {/* Wordmark */}
            <text
               x='120'
               y='292'
               textAnchor='middle'
               fill='var(--color-gold-300)'
               opacity='0.9'
               style={{ font: '600 17px var(--font-display)', letterSpacing: '0.3em' }}
            >
               GREEDY PIRATE
            </text>
         </svg>

         {/* Sheen sweep */}
         <div className='pointer-events-none absolute inset-0 overflow-hidden rounded-2xl'>
            <div className='animate-card-sheen absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent' />
         </div>
      </div>
   );
}

/* ────────────────────────── Card fronts ────────────────────────── */

function CardFront({ card, className }: { card: GameCard | null; className?: string }) {
   if (!card) return <div className={className} />;
   if (card.kind === 'pirate') return <PirateFace className={className} />;
   return <GoldFace className={className} value={card.value} />;
}

function PirateFace({ className }: { className?: string }) {
   return (
      <div
         className={cn(
            'overflow-hidden rounded-2xl border-2 border-[color:var(--color-blood-800)] card-shadow coral-glow',
            className,
         )}
      >
         <svg viewBox='0 0 240 320' className='h-full w-full' aria-hidden='true'>
            <defs>
               <linearGradient id='gppir-bg' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='var(--color-blood-700)' />
                  <stop offset='45%' stopColor='var(--color-blood-800)' />
                  <stop offset='100%' stopColor='var(--color-abyss-950)' />
               </linearGradient>
               <radialGradient id='gppir-smoke' cx='50%' cy='35%' r='65%'>
                  <stop offset='0%' stopColor='rgb(255 59 138 / 0.3)' />
                  <stop offset='100%' stopColor='transparent' />
               </radialGradient>
            </defs>

            <rect width='240' height='320' fill='url(#gppir-bg)' />
            <rect width='240' height='320' fill='url(#gppir-smoke)' />

            {/* Lightning crack accents */}
            <g stroke='var(--color-coral-400)' strokeWidth='1.5' fill='none' opacity='0.55' strokeLinejoin='round'>
               <path d='M28 12 L36 44 L28 52 L40 84' />
               <path d='M212 18 L202 50 L212 60 L198 92' />
            </g>

            {/* Frame — jagged, hostile */}
            <rect x='10' y='10' width='220' height='300' rx='12' fill='none' stroke='var(--color-coral-600)' strokeWidth='2.5' />
            <rect x='17' y='17' width='206' height='286' rx='8' fill='none' stroke='var(--color-coral-500)' strokeWidth='1' opacity='0.5' strokeDasharray='8 5' />

            {/* Big jolly roger */}
            <g transform='translate(120,132)'>
               {/* crossed swords */}
               <g strokeLinecap='round'>
                  <line x1='-58' y1='52' x2='52' y2='-50' stroke='var(--color-cream-200)' strokeWidth='7' />
                  <line x1='58' y1='52' x2='-52' y2='-50' stroke='var(--color-cream-200)' strokeWidth='7' />
                  <line x1='-62' y1='56' x2='-48' y2='44' stroke='var(--color-gold-500)' strokeWidth='10' />
                  <line x1='62' y1='56' x2='48' y2='44' stroke='var(--color-gold-500)' strokeWidth='10' />
               </g>
               {/* skull */}
               <g>
                  <path
                     d='M0 -58 C-30 -58 -50 -37 -50 -10 C-50 6 -41 19 -28 26 L-28 36 C-28 41 -24 45 -19 45 L19 45 C24 45 28 41 28 36 L28 26 C41 19 50 6 50 -10 C50 -37 30 -58 0 -58 Z'
                     fill='var(--color-cream-100)'
                  />
                  {/* eye sockets — angry slant */}
                  <path d='M-31 -14 L-7 -6 C-7 4 -13 9 -20 9 C-28 9 -33 1 -31 -14 Z' fill='var(--color-abyss-950)' />
                  <path d='M31 -14 L7 -6 C7 4 13 9 20 9 C28 9 33 1 31 -14 Z' fill='var(--color-abyss-950)' />
                  <circle cx='-17' cy='-1' r='3' fill='var(--color-coral-500)' />
                  <circle cx='17' cy='-1' r='3' fill='var(--color-coral-500)' />
                  {/* nose */}
                  <path d='M0 8 L6 19 L-6 19 Z' fill='var(--color-abyss-950)' />
                  {/* teeth */}
                  <g stroke='var(--color-abyss-950)' strokeWidth='2.4'>
                     <line x1='-12' y1='33' x2='-12' y2='43' />
                     <line x1='-4' y1='34' x2='-4' y2='44' />
                     <line x1='4' y1='34' x2='4' y2='44' />
                     <line x1='12' y1='33' x2='12' y2='43' />
                  </g>
                  {/* scar */}
                  <g stroke='var(--color-coral-600)' strokeWidth='2' strokeLinecap='round'>
                     <line x1='24' y1='-44' x2='34' y2='-26' />
                     <line x1='25' y1='-39' x2='31' y2='-42' />
                     <line x1='29' y1='-32' x2='35' y2='-35' />
                  </g>
               </g>
            </g>

            <text
               x='120'
               y='268'
               textAnchor='middle'
               fill='var(--color-cream-100)'
               style={{ font: '400 44px var(--font-display)', letterSpacing: '0.12em' }}
            >
               PIRATE!
            </text>
            <text
               x='120'
               y='292'
               textAnchor='middle'
               fill='var(--color-coral-300)'
               opacity='0.85'
               style={{ font: '600 12px var(--font-sans)', letterSpacing: '0.28em' }}
            >
               YER STREAK BE SUNK
            </text>
         </svg>
      </div>
   );
}

function GoldFace({ value, className }: { value: number; className?: string }) {
   return (
      <div
         className={cn(
            'overflow-hidden rounded-2xl border-2 border-[color:var(--color-gold-500)] card-shadow treasure-glow',
            className,
         )}
      >
         <svg viewBox='0 0 240 320' className='h-full w-full' aria-hidden='true'>
            <defs>
               <linearGradient id='gpgold-parch' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='var(--color-parchment-100)' />
                  <stop offset='100%' stopColor='var(--color-parchment-300)' />
               </linearGradient>
               <radialGradient id='gpgold-light' cx='50%' cy='38%' r='62%'>
                  <stop offset='0%' stopColor='rgb(255 234 160 / 0.85)' />
                  <stop offset='100%' stopColor='transparent' />
               </radialGradient>
               <radialGradient id='gpgold-coin' cx='38%' cy='32%' r='72%'>
                  <stop offset='0%' stopColor='var(--color-gold-200)' />
                  <stop offset='55%' stopColor='var(--color-gold-400)' />
                  <stop offset='100%' stopColor='var(--color-gold-600)' />
               </radialGradient>
            </defs>

            <rect width='240' height='320' fill='url(#gpgold-parch)' />
            <rect width='240' height='320' fill='url(#gpgold-light)' />

            {/* Parchment age stains */}
            <circle cx='52' cy='268' r='44' fill='rgb(120 80 30 / 0.08)' />
            <circle cx='200' cy='60' r='38' fill='rgb(120 80 30 / 0.07)' />

            {/* Rope border */}
            <rect x='10' y='10' width='220' height='300' rx='12' fill='none' stroke='var(--color-gold-500)' strokeWidth='3' />
            <rect x='16' y='16' width='208' height='288' rx='9' fill='none' stroke='var(--color-wood-600)' strokeWidth='1.4' opacity='0.55' strokeDasharray='5 4' strokeLinecap='round' />

            {/* Corner pips */}
            <text x='28' y='52' fill='var(--color-wood-800)' style={{ font: '400 30px var(--font-display)' }}>
               {value}
            </text>
            <text
               x='212'
               y='268'
               fill='var(--color-wood-800)'
               textAnchor='end'
               transform='rotate(180 206 278)'
               style={{ font: '400 30px var(--font-display)' }}
            >
               {value}
            </text>

            {/* Coin stack shadow */}
            <ellipse cx='120' cy='192' rx='62' ry='12' fill='rgb(120 80 30 / 0.22)' />

            {/* Big doubloon */}
            <g transform='translate(120,134)'>
               <circle r='58' fill='var(--color-gold-600)' />
               <circle r='56' cy='-3' fill='url(#gpgold-coin)' />
               <circle r='44' cy='-3' fill='none' stroke='var(--color-gold-600)' strokeWidth='2' strokeDasharray='3 4' opacity='0.75' strokeLinecap='round' />
               {/* embossed value */}
               <text
                  y='15'
                  textAnchor='middle'
                  fill='var(--color-wood-900)'
                  style={{ font: '400 58px var(--font-display)' }}
               >
                  {value}
               </text>
               {/* sparkles */}
               <g fill='var(--color-cream-100)'>
                  <path d='M-34 -36 L-31 -29 L-24 -26 L-31 -23 L-34 -16 L-37 -23 L-44 -26 L-37 -29 Z' />
                  <path d='M36 -20 L38 -16 L42 -14 L38 -12 L36 -8 L34 -12 L30 -14 L34 -16 Z' opacity='0.85' />
               </g>
            </g>

            {/* Banner ribbon */}
            <g transform='translate(120,242)'>
               <path d='M-86 -2 L-70 -14 L70 -14 L86 -2 L70 14 L-70 14 Z' fill='var(--color-coral-600)' />
               <path d='M-70 -14 L70 -14 L70 14 L-70 14 Z' fill='var(--color-coral-500)' />
               <text
                  y='6'
                  textAnchor='middle'
                  fill='var(--color-cream-100)'
                  style={{ font: '600 14px var(--font-sans)', letterSpacing: '0.24em' }}
               >
                  {value === 1 ? '1 DOUBLOON' : `${value} DOUBLOONS`}
               </text>
            </g>

         </svg>
      </div>
   );
}
