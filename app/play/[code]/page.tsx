import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import {
   fetchSpectators,
   findCompletedOrActiveGame,
   isUserInGame,
   parseEngineState,
} from '@/server/game-room';
import { db } from '@/server/db/client';
import { gameSpectators } from '@/server/db/schema';
import { toPublic } from '@/game/public';
import type { RoomState } from '@/game/public';
import { getSupabaseServer } from '@/server/supabase/server';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import OnlineRoomClient from './OnlineRoomClient';
import JoinGate from './JoinGate';
import SpectateGate from './SpectateGate';

export const dynamic = 'force-dynamic';

export default async function PlayRoomPage({ params }: { params: Promise<{ code: string }> }) {
   const { code } = await params;
   const upper = code.toUpperCase();

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) redirect('/');

   const game = await findCompletedOrActiveGame(upper);
   if (!game) {
      return (
         <main className='flex flex-1 flex-col items-center justify-center px-5 py-10'>
            <PiratePanel variant='deep' className='flex w-full max-w-sm flex-col items-center gap-3 text-center coral-glow'>
               <span className='text-4xl' aria-hidden>🏴‍☠️</span>
               <h1 className='pirate-display text-3xl text-[color:var(--color-coral-500)]'>Room not found</h1>
               <p className='text-sm text-[color:var(--color-cream-200)]/75'>
                  No ship by the code{' '}
                  <span className='pirate-display text-lg tracking-widest text-[color:var(--color-gold-300)]'>
                     {upper}
                  </span>
                  .
               </p>
               <Link href='/choose-game' className='w-full'>
                  <PirateButton variant='tertiary' size='md' fullWidth>
                     Back to port
                  </PirateButton>
               </Link>
            </PiratePanel>
         </main>
      );
   }

   const isHost = game.hostId === user.id;
   const isMember = await isUserInGame(game.id, user.id);
   const isSpectatorRow = !isHost && !isMember
      ? await db.query.gameSpectators.findFirst({
           where: and(eq(gameSpectators.gameId, game.id), eq(gameSpectators.userId, user.id)),
        })
      : null;
   const isSpectator = !!isSpectatorRow;

   if (!isHost && !isMember && !isSpectator) {
      if (game.status === 'lobby') {
         return <JoinGate code={upper} />;
      }
      return <SpectateGate code={upper} />;
   }

   const engineState = parseEngineState(game);
   const spectators = await fetchSpectators(db, game.id);
   const room: RoomState = {
      ...toPublic(engineState),
      code: upper,
      hostId: game.hostId,
      spectators,
   };

   return <OnlineRoomClient gameId={game.id} userId={user.id} initial={room} />;
}
