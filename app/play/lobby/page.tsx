import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { getSupabaseServer } from '@/server/supabase/server';
import type { PublicRoomSummary } from '@/client/realtime/usePublicLobby';
import FindCrewClient from './FindCrewClient';

export const dynamic = 'force-dynamic';

type PublicRoomRow = {
   id: string;
   code: string;
   host_display_name: string;
   player_count: number;
   max_players: number;
   status: 'lobby' | 'active';
   deck_variant: string;
   created_at: string;
};

export default async function PlayLobbyPage() {
   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) redirect('/');

   const rows = (await db.execute<PublicRoomRow>(
      sql`select * from public.list_public_rooms()`,
   )) as unknown as PublicRoomRow[];

   const initial: PublicRoomSummary[] = rows.map((r) => ({
      code: r.code,
      hostDisplayName: r.host_display_name,
      playerCount: Number(r.player_count),
      maxPlayers: Number(r.max_players),
      status: r.status,
      deckVariant: r.deck_variant,
      createdAt:
         typeof r.created_at === 'string'
            ? r.created_at
            : new Date(r.created_at).toISOString(),
   }));

   return <FindCrewClient initial={initial} />;
}
