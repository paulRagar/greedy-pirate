'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/client/supabase/browser';

export type PublicRoomSummary = {
   code: string;
   hostDisplayName: string;
   playerCount: number;
   maxPlayers: number;
   status: 'lobby' | 'active';
   deckVariant: string;
   createdAt: string;
};

type LobbyEvent =
   | { type: 'room_created'; room: PublicRoomSummary }
   | { type: 'room_updated'; code: string; playerCount: number; status: 'lobby' | 'active' }
   | { type: 'room_removed'; code: string };

/**
 * Live feed of public rooms. Seed with an RSC-fetched snapshot from
 * list_public_rooms(); the realtime channel keeps the map in sync with
 * server broadcasts.
 */
export function usePublicLobby(initial: ReadonlyArray<PublicRoomSummary>) {
   const [rooms, setRooms] = useState<Map<string, PublicRoomSummary>>(() => {
      const m = new Map<string, PublicRoomSummary>();
      for (const r of initial) m.set(r.code, r);
      return m;
   });

   useEffect(() => {
      const supabase = getSupabaseBrowser();
      const channel = supabase.channel('lobby:public', {
         config: { broadcast: { self: true, ack: false } },
      });

      const apply = (evt: LobbyEvent) => {
         setRooms((prev) => {
            const next = new Map(prev);
            if (evt.type === 'room_created') {
               next.set(evt.room.code, evt.room);
            } else if (evt.type === 'room_updated') {
               const existing = next.get(evt.code);
               if (existing) {
                  next.set(evt.code, {
                     ...existing,
                     playerCount: evt.playerCount,
                     status: evt.status,
                  });
               }
            } else if (evt.type === 'room_removed') {
               next.delete(evt.code);
            }
            return next;
         });
      };

      channel.on('broadcast', { event: 'room_created' }, (m: { payload?: LobbyEvent }) => {
         if (m.payload?.type === 'room_created') apply(m.payload);
      });
      channel.on('broadcast', { event: 'room_updated' }, (m: { payload?: LobbyEvent }) => {
         if (m.payload?.type === 'room_updated') apply(m.payload);
      });
      channel.on('broadcast', { event: 'room_removed' }, (m: { payload?: LobbyEvent }) => {
         if (m.payload?.type === 'room_removed') apply(m.payload);
      });
      channel.subscribe();

      return () => {
         void supabase.removeChannel(channel);
      };
   }, []);

   return Array.from(rooms.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
   );
}
