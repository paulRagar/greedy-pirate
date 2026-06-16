'use client';

import { PirateLinkButton } from '@/ui/pirate-button/PirateLinkButton';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';

export default function ChooseGameClient() {
   return (
      <main className='scrollbar-none flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-6 safe-bottom sm:py-10'>
         <header className='flex flex-col gap-1 text-center'>
            <h1 className='wordmark-gold pirate-display text-5xl sm:text-6xl'>Choose Yer Voyage</h1>
            <p className='text-sm uppercase tracking-[0.3em] text-[color:var(--color-teal-400)]/80'>
               Two ways to plunder
            </p>
         </header>

         <div className='flex flex-col gap-4'>
            <ModeCard
               title='Shipmate Duel'
               tag='Local'
               tagTone='teal'
               emblem={<SwordsEmblem />}
               glow='teal-glow'
               subtitle='Pass the device around. 2–10 crewmates duel for doubloons on one screen.'
               action={
                  <PirateLinkButton href='/setup' variant='primary' size='lg' fullWidth>
                     Play Local
                  </PirateLinkButton>
               }
            />
            <ModeCard
               title="Seafarer's Standoff"
               tag='Online'
               tagTone='coral'
               emblem={<GlobeEmblem />}
               glow='orchid-glow'
               subtitle='Sail against friends on other devices. Real-time, server-authoritative, no peeking at the deck.'
               action={
                  <div className='flex flex-col gap-2'>
                     <PirateLinkButton href='/play/new' variant='secondary' size='lg' fullWidth>
                        Charter Ship
                     </PirateLinkButton>
                     <PirateLinkButton href='/play/lobby' variant='tertiary' size='md' fullWidth>
                        Find Crew
                     </PirateLinkButton>
                  </div>
               }
            />
         </div>
      </main>
   );
}

function ModeCard({
   title,
   subtitle,
   tag,
   tagTone,
   emblem,
   glow,
   action,
}: {
   title: string;
   subtitle: string;
   tag: string;
   tagTone: 'teal' | 'coral';
   emblem: React.ReactNode;
   glow: string;
   action: React.ReactNode;
}) {
   return (
      <PiratePanel variant='deep' className={`relative flex flex-col gap-3 overflow-hidden ${glow}`}>
         <div className='pointer-events-none absolute -right-6 -top-6 h-32 w-32 opacity-[0.16]' aria-hidden>
            {emblem}
         </div>
         <div className='flex items-start justify-between gap-2'>
            <div className='flex items-center gap-3'>
               <span className='inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-gold-400)]/40 bg-[color:var(--color-abyss-900)]/70'>
                  <span className='h-8 w-8'>{emblem}</span>
               </span>
               <h2 className='pirate-display text-3xl text-[color:var(--color-gold-300)] sm:text-4xl'>{title}</h2>
            </div>
            <span
               className={
                  tagTone === 'teal'
                     ? 'shrink-0 rounded-full bg-[color:var(--color-teal-400)]/15 px-2.5 py-1 text-xs uppercase tracking-wider text-[color:var(--color-teal-400)]'
                     : 'shrink-0 rounded-full bg-[color:var(--color-coral-500)]/15 px-2.5 py-1 text-xs uppercase tracking-wider text-[color:var(--color-coral-400)]'
               }>
               {tag}
            </span>
         </div>
         <p className='text-sm text-[color:var(--color-cream-200)]/80 sm:text-base'>{subtitle}</p>
         {action}
      </PiratePanel>
   );
}

function SwordsEmblem() {
   // One cutlass drawn point-up, mirrored to cross. Curved tapered blade,
   // gold knuckle-guard, wrapped grip, pommel.
   const cutlass = (
      <>
         {/* blade — curved, tapers to a point, with a fuller line */}
         <path
            d='M0 -21.5 C3.4 -16 4.4 -8 3 1.5 L-1.8 1.5 C-2.4 -8 -1.8 -16 0 -21.5 Z'
            fill='var(--color-teal-300)'
         />
         <path
            d='M0 -21.5 C3.4 -16 4.4 -8 3 1.5 L1.4 1.5 C1.8 -9 1.4 -15 0 -21.5 Z'
            fill='var(--color-teal-500)'
            opacity='0.85'
         />
         <path d='M0.2 -17 C1.6 -12 2 -6 1.4 0' stroke='var(--color-deep-700)' strokeWidth='0.7' fill='none' opacity='0.6' />
         {/* crossguard + knuckle bow */}
         <rect x='-4.6' y='1.5' width='9.2' height='2.4' rx='1.2' fill='var(--color-gold-400)' />
         <path d='M-3.6 2.7 C-6.4 6.4 -5.6 10.4 -1.6 11.6' stroke='var(--color-gold-500)' strokeWidth='1.8' fill='none' strokeLinecap='round' />
         {/* grip with wraps */}
         <path d='M-1.5 3.9 L1.5 3.9 L1.9 11 L-1.9 11 Z' fill='var(--color-wood-700)' />
         <g stroke='var(--color-gold-500)' strokeWidth='0.8' opacity='0.9'>
            <line x1='-1.6' y1='5.8' x2='1.6' y2='5.8' />
            <line x1='-1.7' y1='7.8' x2='1.7' y2='7.8' />
            <line x1='-1.8' y1='9.8' x2='1.8' y2='9.8' />
         </g>
         {/* pommel */}
         <circle cx='0' cy='12.6' r='2' fill='var(--color-gold-300)' stroke='var(--color-gold-600)' strokeWidth='0.7' />
      </>
   );
   return (
      <svg viewBox='0 0 48 48' className='h-full w-full' aria-hidden='true'>
         <g transform='translate(24,25) rotate(45)'>{cutlass}</g>
         <g transform='translate(24,25) rotate(-45)'>{cutlass}</g>
         <circle cx='24' cy='25' r='2.6' fill='var(--color-coral-500)' stroke='var(--color-gold-400)' strokeWidth='1' />
      </svg>
   );
}

function GlobeEmblem() {
   return (
      <svg viewBox='0 0 48 48' className='h-full w-full' aria-hidden='true'>
         <circle cx='24' cy='24' r='16' fill='none' stroke='var(--color-orchid-500)' strokeWidth='2.5' />
         <ellipse cx='24' cy='24' rx='7' ry='16' fill='none' stroke='var(--color-orchid-500)' strokeWidth='2' opacity='0.7' />
         <line x1='8' y1='24' x2='40' y2='24' stroke='var(--color-orchid-500)' strokeWidth='2' opacity='0.7' />
         <path d='M24 4 L26 9 L24 11 L22 9 Z' fill='var(--color-coral-500)' />
         <circle cx='33' cy='15' r='3' fill='var(--color-gold-400)' />
      </svg>
   );
}
