'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useParallax } from '@/client/hooks/useParallax';
import { PirateButton } from '@/ui/pirate-button/PirateButton';

/**
 * Landing hero — full-bleed key art (night cove, public/hero/home-cove.webp)
 * under a layered atmosphere: theme color grade, drifting mist, contrast
 * scrims, ember coins. The image breathes (Ken Burns) and shifts with
 * pointer/device tilt; the title counter-shifts to sell the depth.
 */
export default function HomeClient() {
   const router = useRouter();
   const parallaxRef = useParallax();

   return (
      <main className='relative isolate flex min-h-0 flex-1 flex-col items-center justify-between overflow-hidden px-5 pb-6 safe-bottom'>
         {/* ── Backdrop: image + atmosphere ── */}
         <div className='absolute inset-0 -z-10 overflow-hidden'>
            {/* Parallax wrapper (moves) > Ken Burns wrapper (breathes) > image */}
            <div ref={parallaxRef} data-depth-x='14' data-depth-y='10' className='absolute inset-0'>
               <div className='animate-hero-pan absolute inset-0'>
                  <Image
                     src='/hero/home-cove.webp'
                     alt=''
                     fill
                     priority
                     quality={85}
                     sizes='(max-width: 768px) 100vw, 768px'
                     className='object-cover'
                     style={{ filter: 'saturate(1.12) contrast(1.04)' }}
                  />
               </div>
            </div>

            {/* Theme color grade — pushes lagoon teal + mystic orchid into the art */}
            <div
               className='absolute inset-0 mix-blend-soft-light'
               style={{
                  background:
                     'radial-gradient(ellipse 70% 50% at 15% 20%, rgb(45 212 191 / 0.55) 0%, transparent 60%),' +
                     'radial-gradient(ellipse 60% 45% at 90% 35%, rgb(139 61 240 / 0.5) 0%, transparent 60%),' +
                     'radial-gradient(ellipse 55% 40% at 70% 95%, rgb(255 59 138 / 0.35) 0%, transparent 65%)',
               }}
               aria-hidden
            />

            {/* Drifting mist band */}
            <div
               className='animate-wave absolute left-0 top-[42%] h-[18%] w-[200%] opacity-50'
               style={{
                  animationDuration: '52s',
                  background:
                     'linear-gradient(90deg, transparent 0%, rgb(94 234 212 / 0.07) 20%, rgb(232 212 156 / 0.05) 45%, transparent 60%, rgb(94 234 212 / 0.06) 80%, transparent 100%)',
               }}
               aria-hidden
            />

            {/* Blend into the app frame: fade top edge + ground the CTA zone */}
            <div className='absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[color:var(--color-abyss-950)]/90 to-transparent' aria-hidden />
            <div className='absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[color:var(--color-abyss-950)]/95 via-[color:var(--color-abyss-950)]/45 to-transparent' aria-hidden />

            {/* Soft edge vignette for focus + text contrast */}
            <div
               className='absolute inset-0'
               style={{
                  background:
                     'radial-gradient(ellipse 105% 90% at 50% 42%, transparent 55%, rgb(2 6 15 / 0.55) 100%)',
               }}
               aria-hidden
            />
         </div>

         <FloatingCoins />

         {/* ── Title — counter-parallax against the backdrop ── */}
         <section
            ref={parallaxRef}
            data-depth-x='-7'
            data-depth-y='-4'
            className='relative z-10 flex flex-col items-center gap-2 pt-[9vh] text-center'
         >
            <div className='animate-hero-bob flex flex-col items-center gap-2'>
               <h1 className='wordmark-gold pirate-display text-6xl leading-[0.95] drop-shadow-[0_6px_24px_rgb(2_6_15/0.8)] sm:text-8xl'>
                  Greedy Pirate
               </h1>
               <p className='pirate-display text-base uppercase tracking-[0.3em] text-[color:var(--color-teal-300)]/90 [text-shadow:0_2px_12px_rgb(2_6_15/0.9)] sm:text-lg'>
                  Fortune favors the bold
               </p>
            </div>
         </section>

         {/* ── Lore + CTA ── */}
         <div className='relative z-10 flex w-full max-w-sm flex-col items-center gap-4'>
            <p className='pirate-display px-2 text-center text-lg leading-snug text-[color:var(--color-cream-200)]/95 [text-shadow:0_2px_10px_rgb(2_6_15/0.95)] sm:text-2xl'>
               Plunder doubloons one card at a time.
               <span className='block text-[color:var(--color-coral-400)]'>Bank what ye dare.</span>
               <span className='block text-[color:var(--color-orchid-400)]'>Beware of pirates — or lose it all.</span>
            </p>
            <PirateButton
               variant='primary'
               size='lg'
               fullWidth
               onClick={() => router.push('/choose-game')}
               className='text-2xl sm:text-3xl'
            >
               Set Sail
            </PirateButton>
            <span className='text-sm uppercase tracking-[0.35em] text-[color:var(--color-cream-200)]/55 [text-shadow:0_1px_8px_rgb(2_6_15/0.9)]'>
               Press to play
            </span>
         </div>
      </main>
   );
}

/* ───────────────────── Floating ember coins ───────────────────── */

const COIN_POSITIONS: { left: string; size: number; duration: number; delay: number }[] = [
   { left: '8%', size: 14, duration: 9, delay: 0 },
   { left: '22%', size: 10, duration: 11, delay: 2.5 },
   { left: '38%', size: 16, duration: 10, delay: 4 },
   { left: '55%', size: 12, duration: 12, delay: 1 },
   { left: '72%', size: 14, duration: 9.5, delay: 3 },
   { left: '88%', size: 10, duration: 11.5, delay: 5.5 },
   { left: '15%', size: 8, duration: 8, delay: 6 },
   { left: '80%', size: 18, duration: 13, delay: 2 },
];

function FloatingCoins() {
   return (
      <div className='pointer-events-none absolute inset-0 z-0 overflow-hidden' aria-hidden='true'>
         {COIN_POSITIONS.map((c, i) => (
            <div
               key={i}
               className='animate-float-up absolute bottom-0'
               style={{
                  left: c.left,
                  width: c.size,
                  height: c.size,
                  animationDuration: `${c.duration}s`,
                  animationDelay: `${c.delay}s`,
               }}
            >
               <CoinSparkle />
            </div>
         ))}
      </div>
   );
}

function CoinSparkle() {
   return (
      <svg viewBox='0 0 20 20' className='h-full w-full drop-shadow-[0_0_6px_rgb(255_217_102/0.55)]'>
         <defs>
            <radialGradient id='cs' cx='40%' cy='35%' r='65%'>
               <stop offset='0%' stopColor='var(--color-gold-200)' />
               <stop offset='65%' stopColor='var(--color-gold-400)' />
               <stop offset='100%' stopColor='var(--color-gold-600)' />
            </radialGradient>
         </defs>
         <circle cx='10' cy='10' r='8' fill='url(#cs)' stroke='var(--color-wood-700)' strokeWidth='0.6' />
         <circle cx='8' cy='7' r='1.4' fill='var(--color-gold-200)' opacity='0.9' />
      </svg>
   );
}
