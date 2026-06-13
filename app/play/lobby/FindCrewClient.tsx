'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { requestJoin } from '@/server/actions/requestJoin';
import {
   usePublicLobby,
   type PublicRoomSummary,
} from '@/client/realtime/usePublicLobby';

export default function FindCrewClient({ initial }: { initial: PublicRoomSummary[] }) {
   const router = useRouter();
   const rooms = usePublicLobby(initial);
   const [joining, setJoining] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);

   const board = async (code: string, kind: 'player' | 'spectator') => {
      setJoining(`${code}:${kind}`);
      setError(null);
      const res = await requestJoin({ code, kind });
      setJoining(null);
      if (!res.ok) {
         setError(res.error);
         return;
      }
      router.push(`/play/${code}`);
   };

   return (
      <main className='scrollbar-none flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-6 safe-bottom sm:py-10'>
         <header className='flex flex-col gap-1 text-center'>
            <h1 className='wordmark-gold pirate-display text-5xl sm:text-6xl'>Find Crew</h1>
            <p className='text-sm text-[color:var(--color-cream-200)]/75'>
               Open voyages chartered by other captains. Board to play or watch the action.
            </p>
         </header>

         <div className='flex flex-col gap-2'>
            <Link href='/play/join' className='w-full'>
               <PirateButton variant='secondary' size='md' fullWidth>
                  Have a code? Board a sealed ship
               </PirateButton>
            </Link>
         </div>

         {error && (
            <p className='text-center text-sm text-[color:var(--color-coral-500)]'>{error}</p>
         )}

         {rooms.length === 0 ? (
            <PiratePanel variant='deep' className='flex flex-col items-center gap-2 text-center'>
               <span className='text-4xl' aria-hidden>
                  🏝️
               </span>
               <p className='pirate-display text-xl text-[color:var(--color-gold-300)]'>
                  Empty waters
               </p>
               <p className='text-sm text-[color:var(--color-cream-200)]/70'>
                  No open voyages right now. Charter yer own and let the crew come to ye.
               </p>
               <Link href='/play/new' className='w-full'>
                  <PirateButton variant='primary' size='md' fullWidth>
                     Charter Ship
                  </PirateButton>
               </Link>
            </PiratePanel>
         ) : (
            <ul className='flex flex-col gap-2'>
               {rooms.map((r) => (
                  <li key={r.code}>
                     <RoomRow
                        room={r}
                        onBoard={() => board(r.code, 'player')}
                        onSpectate={() => board(r.code, 'spectator')}
                        joiningKind={
                           joining?.startsWith(`${r.code}:`)
                              ? (joining.split(':')[1] as 'player' | 'spectator')
                              : null
                        }
                     />
                  </li>
               ))}
            </ul>
         )}

         <div className='mt-auto pt-2 safe-bottom'>
            <Link href='/choose-game' className='w-full'>
               <PirateButton variant='tertiary' size='md' fullWidth>
                  Back to port
               </PirateButton>
            </Link>
         </div>
      </main>
   );
}

function RoomRow({
   room,
   onBoard,
   onSpectate,
   joiningKind,
}: {
   room: PublicRoomSummary;
   onBoard: () => void;
   onSpectate: () => void;
   joiningKind: 'player' | 'spectator' | null;
}) {
   const isActive = room.status === 'active';
   const seatsFree = room.playerCount < room.maxPlayers;
   const showBoard = !isActive && seatsFree;

   return (
      <PiratePanel variant='deep' className='flex flex-col gap-2 p-3'>
         <div className='flex items-center justify-between gap-2'>
            <div className='flex flex-col gap-0.5'>
               <span className='font-mono font-bold text-xl tracking-widest text-[color:var(--color-gold-300)]'>
                  {room.code}
               </span>
               <span className='text-xs text-[color:var(--color-cream-200)]/70'>
                  Cap&apos;n {room.hostDisplayName}
               </span>
            </div>
            <div className='flex flex-col items-end gap-0.5'>
               <span className='text-sm font-semibold text-[color:var(--color-cream-200)]'>
                  {room.playerCount}/{room.maxPlayers}
               </span>
               <span
                  className={
                     isActive
                        ? 'rounded-full bg-[color:var(--color-coral-500)]/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--color-coral-400)]'
                        : 'rounded-full bg-[color:var(--color-teal-400)]/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--color-teal-400)]'
                  }
               >
                  {isActive ? 'Underway' : 'Boarding'}
               </span>
            </div>
         </div>
         <div className='flex gap-2'>
            {showBoard ? (
               <PirateButton
                  variant='primary'
                  size='sm'
                  fullWidth
                  onClick={onBoard}
                  disabled={joiningKind !== null}
                  title='Take a seat'
               >
                  {joiningKind === 'player' ? '…' : 'Board'}
               </PirateButton>
            ) : null}
            <PirateButton
               variant='tertiary'
               size='sm'
               fullWidth
               onClick={onSpectate}
               disabled={joiningKind !== null}
               title='Watch the voyage'
            >
               {joiningKind === 'spectator' ? '…' : 'Spectate'}
            </PirateButton>
         </div>
      </PiratePanel>
   );
}
