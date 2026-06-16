'use client';

import { useState } from 'react';
import { GuestAvatar } from '@/ui/avatar/GuestAvatar';
import { DisplayNameEditor } from '@/ui/display-name/DisplayNameEditor';

interface Props {
   initialName: string;
   isAnonymous: boolean;
   userIdShort?: string;
   size?: 'md' | 'lg';
}

function initialsOf(name: string | undefined): string {
   return name?.trim()[0]?.toUpperCase() ?? 'P';
}

export function ProfileNameHeader({ initialName, isAnonymous, userIdShort, size = 'lg' }: Props) {
   const [name, setName] = useState(initialName);
   const [editing, setEditing] = useState(false);
   const dim = size === 'lg' ? 'h-32 w-32' : 'h-24 w-24';
   const font = size === 'lg' ? 'text-5xl' : 'text-4xl';

   return (
      <>
         <header className='flex flex-col items-center gap-3'>
            {isAnonymous ? (
               <div className='relative inline-flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white/20 bg-white/5 text-[color:var(--color-cream-200)]/40'>
                  <GuestAvatar className='h-14 w-14' />
                  <span className='pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10' />
               </div>
            ) : (
               <div
                  className={`relative inline-flex ${dim} items-center justify-center overflow-hidden rounded-full border-4 border-[color:var(--color-gold-400)]/85 bg-gradient-to-br from-[color:var(--color-coral-500)] via-[color:var(--color-orchid-600)] to-[color:var(--color-deep-700)] shadow-[0_0_28px_rgb(255_182_39_/_0.32),0_10px_28px_-4px_rgb(0_0_0_/_0.6)]`}
               >
                  <span
                     className={`pirate-display ${font} font-bold text-[color:var(--color-cream-100)] [text-shadow:0_2px_4px_rgb(0_0_0/0.55)]`}
                  >
                     {initialsOf(name)}
                  </span>
                  <span className='pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/15' />
               </div>
            )}
            <div className='flex items-center gap-2'>
               <h1 className='pirate-display text-4xl text-[color:var(--color-gold-300)] sm:text-5xl'>{name}</h1>
               <button
                  type='button'
                  data-testid='profile-rename'
                  onClick={() => setEditing(true)}
                  className='inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-surface-border)] bg-[color:var(--color-abyss-900)]/60 text-[color:var(--color-cream-200)]/75 transition-colors hover:border-[color:var(--color-gold-500)]/60 hover:text-[color:var(--color-gold-300)]'
                  aria-label='Edit display name'
                  title='Edit display name'
               >
                  ✎
               </button>
            </div>
            <p className='text-xs text-[color:var(--color-cream-200)]/55'>
               {isAnonymous ? 'Guest crewmate' : userIdShort ? `Email account · ID ${userIdShort}` : 'Email account'}
            </p>
         </header>
         <DisplayNameEditor
            open={editing}
            currentName={name}
            isAnonymous={isAnonymous}
            onClose={() => setEditing(false)}
            onSaved={(next) => setName(next)}
         />
      </>
   );
}
