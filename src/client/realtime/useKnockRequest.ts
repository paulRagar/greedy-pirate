'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { cancelJoinRequest } from '@/server/actions/cancelJoinRequest';

const KNOCK_RESOLVED_EVENT = 'knock:resolved';
const KNOCK_CANCELLED_EVENT = 'knock:cancelled';

export type KnockStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'cancelled';

type Params = {
   code: string;
   requestId: string | null;
   expiresAt: string | null;
};

/**
 * Subscribe to the room channel after a knock has been submitted. Tracks
 * remaining countdown until the host either approves or the server-side
 * expiry fires. Calling `cancel()` rescinds the hail and removes the
 * host's toast.
 */
export function useKnockRequest({ code, requestId, expiresAt }: Params) {
   const [status, setStatus] = useState<KnockStatus>('pending');
   const [secondsLeft, setSecondsLeft] = useState<number>(() =>
      expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0,
   );
   const requestIdRef = useRef(requestId);
   requestIdRef.current = requestId;

   const cancel = useCallback(async () => {
      const id = requestIdRef.current;
      if (!id) return;
      if (status !== 'pending') return;
      setStatus('cancelled');
      await cancelJoinRequest({ requestId: id }).catch((err) =>
         console.error('cancelJoinRequest failed', err),
      );
   }, [status]);

   useEffect(() => {
      setStatus('pending');
      if (expiresAt) {
         setSecondsLeft(Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
      }
   }, [requestId, expiresAt]);

   useEffect(() => {
      if (!requestId || !expiresAt) return;
      const target = new Date(expiresAt).getTime();
      const tick = () => {
         const ms = target - Date.now();
         const secs = Math.max(0, Math.ceil(ms / 1000));
         setSecondsLeft(secs);
         if (secs === 0) setStatus((s) => (s === 'pending' ? 'expired' : s));
      };
      tick();
      const interval = setInterval(tick, 500);
      return () => clearInterval(interval);
   }, [requestId, expiresAt]);

   useEffect(() => {
      if (!requestId) return;
      const supabase = getSupabaseBrowser();
      const topic = `room:${code.toUpperCase()}`;
      const channel = supabase.channel(topic, {
         config: { broadcast: { self: false, ack: false } },
      });

      channel.on(
         'broadcast',
         { event: KNOCK_RESOLVED_EVENT },
         (message: { payload?: { requestId: string; outcome: KnockStatus } }) => {
            const p = message.payload;
            if (!p) return;
            if (p.requestId !== requestId) return;
            setStatus(p.outcome);
         },
      );
      channel.on(
         'broadcast',
         { event: KNOCK_CANCELLED_EVENT },
         (message: { payload?: { requestId: string } }) => {
            if (message.payload?.requestId !== requestId) return;
            setStatus('cancelled');
         },
      );
      channel.subscribe();

      return () => {
         void supabase.removeChannel(channel);
      };
   }, [code, requestId]);

   // Auto-rescind if the knocker navigates away while still pending.
   useEffect(() => {
      return () => {
         const id = requestIdRef.current;
         if (!id) return;
         // Fire-and-forget — status state may already be terminal by then.
         void cancelJoinRequest({ requestId: id }).catch(() => {});
      };
   }, []);

   return { status, secondsLeft, cancel };
}
