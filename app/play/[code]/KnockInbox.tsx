'use client';

import { useEffect, useState } from 'react';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { respondToJoinRequest } from '@/server/actions/respondToJoinRequest';

export type KnockEntry = {
   requestId: string;
   requesterId: string;
   displayName: string;
   kind: 'player' | 'spectator';
   expiresAt: string;
};

type Props = {
   knocks: KnockEntry[];
   onRemove: (requestId: string) => void;
};

export default function KnockInbox({ knocks, onRemove }: Props) {
   const [responding, setResponding] = useState<string | null>(null);

   // Drop expired locally even if the cron broadcast hasn't landed.
   useEffect(() => {
      const id = setInterval(() => {
         const now = Date.now();
         for (const k of knocks) {
            if (new Date(k.expiresAt).getTime() <= now) onRemove(k.requestId);
         }
      }, 1000);
      return () => clearInterval(id);
   }, [knocks, onRemove]);

   if (knocks.length === 0) return null;

   const respond = async (requestId: string, approve: boolean) => {
      setResponding(requestId);
      const res = await respondToJoinRequest({ requestId, approve });
      setResponding(null);
      if (!res.ok) console.warn('respondToJoinRequest', res.error);
      onRemove(requestId);
   };

   return (
      <div className='fixed inset-x-0 top-3 z-40 flex flex-col items-center gap-2 px-4'>
         {knocks.map((k) => (
            <div
               key={k.requestId}
               className='w-full max-w-sm rounded-2xl border-2 border-[color:var(--color-gold-400)]/60 bg-[color:var(--color-deep-800)]/95 p-3 shadow-card-deep backdrop-blur-md'
            >
               <div className='flex items-center justify-between gap-2'>
                  <div className='flex flex-col'>
                     <span className='text-sm text-[color:var(--color-cream-200)]/75'>
                        {k.kind === 'spectator' ? 'Wants to watch' : 'Wants to board'}
                     </span>
                     <span className='pirate-display text-lg text-[color:var(--color-gold-300)]'>
                        {k.displayName}
                     </span>
                  </div>
                  <CountdownBadge expiresAt={k.expiresAt} />
               </div>
               <div className='mt-2 flex gap-2'>
                  <PirateButton
                     variant='danger'
                     size='sm'
                     fullWidth
                     onClick={() => respond(k.requestId, false)}
                     disabled={responding === k.requestId}
                     data-testid='knock-deny'
                  >
                     {responding === k.requestId ? '…' : "Send 'em packing"}
                  </PirateButton>
                  <PirateButton
                     variant='primary'
                     size='sm'
                     fullWidth
                     onClick={() => respond(k.requestId, true)}
                     disabled={responding === k.requestId}
                     data-testid='knock-approve'
                  >
                     {responding === k.requestId ? '…' : 'Welcome aboard'}
                  </PirateButton>
               </div>
            </div>
         ))}
      </div>
   );
}

function CountdownBadge({ expiresAt }: { expiresAt: string }) {
   const [secs, setSecs] = useState(() =>
      Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)),
   );
   useEffect(() => {
      const id = setInterval(() => {
         setSecs(Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
      }, 500);
      return () => clearInterval(id);
   }, [expiresAt]);
   return (
      <span className='shrink-0 rounded-full bg-[color:var(--color-abyss-900)]/70 px-2 py-1 text-xs text-[color:var(--color-cream-200)]/75'>
         {secs}s
      </span>
   );
}
