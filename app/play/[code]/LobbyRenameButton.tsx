'use client';

import { useState } from 'react';
import { DisplayNameEditor } from '@/ui/display-name/DisplayNameEditor';
import { useCurrentUser } from '@/client/auth/useCurrentUser';

interface Props {
   currentName: string;
}

export function LobbyRenameButton({ currentName }: Props) {
   const [open, setOpen] = useState(false);
   const { profile } = useCurrentUser();
   return (
      <>
         <button
            type='button'
            data-testid='lobby-rename'
            onClick={() => setOpen(true)}
            className='inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-r-xl text-[color:var(--color-cream-200)]/60 transition-colors hover:bg-white/5 hover:text-[color:var(--color-gold-300)]'
            aria-label='Edit yer name'
            title='Edit yer name'
         >
            ✎
         </button>
         <DisplayNameEditor
            open={open}
            currentName={currentName}
            isAnonymous={profile?.isAnonymous ?? false}
            onClose={() => setOpen(false)}
         />
      </>
   );
}
