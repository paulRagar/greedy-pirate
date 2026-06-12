'use client';

import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PirateModal } from '@/ui/pirate-modal/PirateModal';

interface Props {
   message: string;
   hint: string | null;
   onRetry: () => void;
}

export function AuthErrorOverlay({ message, hint, onRetry }: Props) {
   return (
      <PirateModal open dismissible={false} title="Couldn't muster ye into the crew">
         <div className='flex flex-col gap-3'>
            <p className='text-sm text-[color:var(--color-cream-200)]/85'>
               We tried to sign ye in anonymously but the server didn&apos;t answer.
            </p>
            <pre className='whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 text-xs text-[color:var(--color-blood-600)]'>
               {message}
            </pre>
            {hint && (
               <div className='rounded-lg border border-[color:var(--color-treasure-500)]/40 bg-[color:var(--color-treasure-500)]/10 p-3 text-sm text-[color:var(--color-cream-100)]'>
                  <p className='mb-1 font-semibold text-[color:var(--color-gold-300)]'>Looks like a LAN-test setup.</p>
                  <p>{hint}</p>
               </div>
            )}
            <PirateButton variant='primary' size='md' fullWidth onClick={onRetry}>
               Try again
            </PirateButton>
         </div>
      </PirateModal>
   );
}
