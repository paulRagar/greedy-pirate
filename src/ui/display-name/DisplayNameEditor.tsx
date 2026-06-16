'use client';

import { useEffect, useState } from 'react';
import { setDisplayName } from '@/server/actions/setDisplayName';
import { emitProfileChanged } from '@/client/auth/useCurrentUser';
import { AccountLinkModal } from '@/client/auth/AccountLinkModal';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateModal } from '@/ui/pirate-modal/PirateModal';

interface Props {
   open: boolean;
   currentName: string;
   isAnonymous: boolean;
   onClose: () => void;
   onSaved?: (name: string) => void;
}

const MAX_LEN = 20;

export function DisplayNameEditor({ open, currentName, isAnonymous, onClose, onSaved }: Props) {
   const [name, setName] = useState(currentName);
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const [authOpen, setAuthOpen] = useState(false);

   useEffect(() => {
      if (open) {
         setName(currentName);
         setError(null);
         setSubmitting(false);
      }
   }, [open, currentName]);

   const trimmed = name.trim();
   const unchanged = trimmed === currentName.trim();
   const canSave = !submitting && trimmed.length > 0 && !unchanged;

   const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSave) return;
      setError(null);
      setSubmitting(true);
      const result = await setDisplayName(name);
      setSubmitting(false);
      if (result.ok) {
         emitProfileChanged();
         onSaved?.(result.name);
         onClose();
      } else {
         setError(result.error);
      }
   };

   return (
      <PirateModal open={open} onClose={onClose} dismissible title='Change yer name'>
         <form onSubmit={submit} className='flex flex-col gap-3'>
            <input
               type='text'
               data-testid='display-name-input'
               value={name}
               onChange={(e) => setName(e.target.value)}
               autoFocus
               maxLength={MAX_LEN}
               inputMode='text'
               autoCapitalize='words'
               autoComplete='nickname'
               className='input-pirate text-base'
               placeholder='Captain Blackbeard'
               aria-label='Display name'
            />
            <div className='flex items-start justify-between gap-2 text-xs'>
               <p data-testid='display-name-error' className='text-[color:var(--color-coral-400)]'>
                  {error ?? ''}
               </p>
               <p className='shrink-0 text-[color:var(--color-cream-200)]/55'>
                  {trimmed.length}/{MAX_LEN}
               </p>
            </div>
            {isAnonymous && (
               <p className='rounded-lg border border-dashed border-[color:var(--color-gold-500)]/40 bg-[color:var(--color-abyss-900)]/40 p-2.5 text-xs text-[color:var(--color-cream-200)]/75'>
                  Sailin&apos; as a guest.{' '}
                  <button
                     type='button'
                     onClick={() => setAuthOpen(true)}
                     className='underline decoration-dotted underline-offset-2 hover:text-[color:var(--color-gold-300)]'
                  >
                     Link an email
                  </button>{' '}
                  to save yer name across devices.
               </p>
            )}
            <div className='flex gap-2'>
               <PirateButton variant='ghost' size='md' fullWidth type='button' onClick={onClose}>
                  Cancel
               </PirateButton>
               <PirateButton
                  variant='primary'
                  size='md'
                  fullWidth
                  type='submit'
                  disabled={!canSave}
                  data-testid='display-name-save'
               >
                  {submitting ? 'Savin…' : 'Save'}
               </PirateButton>
            </div>
         </form>
         <AccountLinkModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </PirateModal>
   );
}
