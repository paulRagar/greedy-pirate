'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom } from '@/server/actions/createRoom';
import { useCurrentUser } from '@/client/auth/useCurrentUser';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateLinkButton } from '@/ui/pirate-button/PirateLinkButton';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { cn } from '@/lib/cn';

type Visibility = 'public' | 'private';

export default function NewRoomClient() {
   const router = useRouter();
   const { ready } = useCurrentUser();
   const [visibility, setVisibility] = useState<Visibility>('private');
   const [submitting, setSubmitting] = useState(false);
   const [navigating, startNavigation] = useTransition();
   const [error, setError] = useState<string | null>(null);

   if (!ready) {
      return (
         <main className='flex flex-1 flex-col items-center justify-center gap-3 px-5 py-10 text-center'>
            <p className='pirate-display animate-pulse text-2xl text-[color:var(--color-gold-300)]'>
               Hoisting the colors…
            </p>
         </main>
      );
   }

   const charter = async () => {
      setSubmitting(true);
      setError(null);
      // Deck type is chosen by the captain in the waiting room, not here.
      const res = await createRoom({ isPublic: visibility === 'public' });
      if (res.ok) {
         startNavigation(() => router.push(`/play/${res.code}`));
      } else {
         setSubmitting(false);
         setError(res.error);
      }
   };

   return (
      <main className='scrollbar-none flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-6 safe-bottom sm:py-10'>
         <header className='flex flex-col gap-1 text-center'>
            <h1 className='wordmark-gold pirate-display text-5xl sm:text-6xl'>Charter a Ship</h1>
            <p className='text-sm text-[color:var(--color-cream-200)]/75'>
               Hoist yer colors, captain. Choose how the crew finds ye.
            </p>
         </header>

         <PiratePanel variant='deep' className='flex flex-col gap-3'>
            <VisibilityOption
               value='public'
               current={visibility}
               onSelect={setVisibility}
               title='Open Voyage'
               subtitle='Anyone can board. Listed in Find Crew for any sailor to join.'
               tag='Public'
               tagTone='teal'
            />
            <VisibilityOption
               value='private'
               current={visibility}
               onSelect={setVisibility}
               title='Sealed Hold'
               subtitle='Captain approves each boarder. Share the room code with yer mates.'
               tag='Private'
               tagTone='coral'
            />
         </PiratePanel>

         {error && <p className='text-center text-sm text-[color:var(--color-coral-500)]'>{error}</p>}

         <div className='mt-auto flex flex-col gap-2 pt-2 safe-bottom'>
            <PirateButton
               variant='primary'
               size='lg'
               fullWidth
               onClick={charter}
               disabled={submitting || navigating}
               loading={submitting || navigating}
            >
               Set Sail
            </PirateButton>
            <PirateLinkButton href='/choose-game' variant='tertiary' size='md' fullWidth>
               Back to port
            </PirateLinkButton>
         </div>
      </main>
   );
}

function VisibilityOption({
   value,
   current,
   onSelect,
   title,
   subtitle,
   tag,
   tagTone,
}: {
   value: Visibility;
   current: Visibility;
   onSelect: (v: Visibility) => void;
   title: string;
   subtitle: string;
   tag: string;
   tagTone: 'teal' | 'coral';
}) {
   const selected = current === value;
   return (
      <button
         type='button'
         onClick={() => onSelect(value)}
         className={cn(
            'flex flex-col items-start gap-1 rounded-2xl border-2 px-4 py-3 text-left transition-all',
            selected
               ? 'border-[color:var(--color-gold-400)] bg-[color:var(--color-deep-700)]/70 shadow-[0_0_24px_-8px_rgb(255_215_120/0.55)]'
               : 'border-[color:var(--color-surface-border)] bg-[color:var(--color-abyss-900)]/40 hover:border-[color:var(--color-gold-500)]/50',
         )}
         aria-pressed={selected}
      >
         <div className='flex w-full items-center justify-between gap-2'>
            <span className='pirate-display text-xl text-[color:var(--color-gold-300)]'>{title}</span>
            <span
               className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider',
                  tagTone === 'teal'
                     ? 'bg-[color:var(--color-teal-400)]/15 text-[color:var(--color-teal-400)]'
                     : 'bg-[color:var(--color-coral-500)]/15 text-[color:var(--color-coral-400)]',
               )}
            >
               {tag}
            </span>
         </div>
         <span className='text-sm text-[color:var(--color-cream-200)]/75'>{subtitle}</span>
      </button>
   );
}
