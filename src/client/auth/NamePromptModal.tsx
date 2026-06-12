'use client';

import { useState } from 'react';
import { setDisplayName } from '@/server/actions/setDisplayName';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateModal } from '@/ui/pirate-modal/PirateModal';
import { emitProfileChanged } from './useCurrentUser';

interface Props {
   onComplete: (name: string) => void;
}

export function NamePromptModal({ onComplete }: Props) {
   const [name, setName] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);

   const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      const result = await setDisplayName(name);
      setSubmitting(false);
      if (result.ok) {
         emitProfileChanged();
         onComplete(result.name);
      } else {
         setError(result.error);
      }
   };

   return (
      <PirateModal open dismissible={false} title='What be yer name, sailor?'>
         <form onSubmit={submit} className='flex flex-col gap-3'>
            <p className='text-sm text-[color:var(--color-cream-200)]/80'>
               Pick a crewmate name. It&apos;ll show up beside yer treasure on the leaderboards.
            </p>
            <input
               type='text'
               value={name}
               onChange={(e) => setName(e.target.value)}
               autoFocus
               maxLength={40}
               inputMode='text'
               autoCapitalize='words'
               autoComplete='nickname'
               className='input-pirate text-base'
               placeholder='Captain Blackbeard'
               aria-label='Display name'
            />
            {error && <p className='text-sm text-[color:var(--color-coral-400)]'>{error}</p>}
            <PirateButton variant='primary' size='md' fullWidth type='submit' disabled={submitting || !name.trim()}>
               {submitting ? 'Hoisting yer flag…' : 'Set Sail'}
            </PirateButton>
         </form>
      </PirateModal>
   );
}
