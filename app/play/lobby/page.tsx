import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { parseRows } from '@/server/db/parseRows';
import { getSupabaseServer } from '@/server/supabase/server';
import type { PublicRoomSummary } from '@/client/realtime/usePublicLobby';
import FindCrewClient from './FindCrewClient';

export const dynamic = 'force-dynamic';

// `created_at` is a timestamptz — postgres-js hydrates it as a Date, but a
// raw string can slip through depending on the driver path, so accept both.
const PublicRoomRow = z.object({
   id: z.string(),
   code: z.string(),
   host_display_name: z.string(),
   player_count: z.number(),
   max_players: z.number(),
   status: z.enum(['lobby', 'active']),
   deck_variant: z.string(),
   created_at: z.union([z.string(), z.date()]),
});

export default async function PlayLobbyPage() {
   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) redirect('/');

   const rows = parseRows(
      await db.execute(sql`select * from public.list_public_rooms()`),
      PublicRoomRow,
   );

   const initial: PublicRoomSummary[] = rows.map((r) => ({
      code: r.code,
      hostDisplayName: r.host_display_name,
      playerCount: r.player_count,
      maxPlayers: r.max_players,
      status: r.status,
      deckVariant: r.deck_variant,
      createdAt:
         typeof r.created_at === 'string'
            ? r.created_at
            : r.created_at.toISOString(),
   }));

   return <FindCrewClient initial={initial} />;
}
