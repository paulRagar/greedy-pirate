'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom } from '@/server/actions/createRoom';
import { DEFAULT_DISPLAY_NAME, useCurrentUser } from '@/client/auth/useCurrentUser';

/**
 * Opens a new online room. We MUST wait for the user to set their real
 * display name before calling createRoom — otherwise the host seat is
 * stamped with the default "Crewmate" placeholder forever in the
 * game_players row (and the lobby UI shows it that way). AuthBootstrap
 * already presents the NamePromptModal on this route; we just sit tight
 * until the profile reflects a non-default name, then fire createRoom
 * exactly once and redirect.
 */
export default function PlayNewPage() {
   const router = useRouter();
   const { ready, profile } = useCurrentUser();
   const [error, setError] = useState<string | null>(null);
   const firedFor = useRef<string | null>(null);

   useEffect(() => {
      if (!ready || !profile) return;
      if (profile.displayName === DEFAULT_DISPLAY_NAME) return;
      if (firedFor.current === profile.id) return;
      firedFor.current = profile.id;
      createRoom()
         .then((res) => {
            if (res.ok) router.push(`/play/${res.code}`);
            else setError(res.error);
         })
         .catch((err) => {
            console.error('createRoom failed', err);
            setError('Failed to open room');
         });
   }, [ready, profile, router]);

   if (error) {
      return (
         <main className='flex flex-1 flex-col items-center justify-center gap-3 px-5 py-10 text-center'>
            <h1 className='pirate-display text-3xl text-[color:var(--color-coral-400)]'>
               Couldn&apos;t open the room
            </h1>
            <p className='text-sm text-[color:var(--color-cream-200)]/70'>{error}</p>
         </main>
      );
   }

   return (
      <main className='flex flex-1 flex-col items-center justify-center gap-3 px-5 py-10 text-center'>
         <p className='pirate-display animate-pulse text-2xl text-[color:var(--color-gold-300)]'>
            Hoisting the colors…
         </p>
      </main>
   );
}
