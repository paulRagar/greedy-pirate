import { notFound } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { games } from '@/server/db/schema';
import { getAdminUser } from '@/server/auth/admin';
import RoomsTable, { type AdminRoomRow } from './RoomsTable';

export const dynamic = 'force-dynamic';

export default async function AdminRoomsPage() {
   const admin = await getAdminUser();
   if (!admin) notFound();

   const rows = await db.query.games.findMany({
      orderBy: [desc(games.createdAt)],
   });

   const seatedCounts = await db.query.gamePlayers.findMany({
      columns: { gameId: true, leftAt: true },
   });
   const seatedByGame = new Map<string, number>();
   for (const p of seatedCounts) {
      if (p.leftAt !== null) continue;
      seatedByGame.set(p.gameId, (seatedByGame.get(p.gameId) ?? 0) + 1);
   }

   const hostRows = await db.query.users.findMany({
      columns: { id: true, displayName: true, email: true },
   });
   const hosts = new Map(
      hostRows.map((u) => [u.id, { name: u.displayName, email: u.email }]),
   );

   const data: AdminRoomRow[] = rows.map((g) => ({
      id: g.id,
      code: g.code,
      isPublic: g.isPublic,
      status: g.status,
      deckVariant: g.deckVariant,
      hostName: hosts.get(g.hostId)?.name ?? '—',
      hostEmail: hosts.get(g.hostId)?.email ?? null,
      seatedPlayers: seatedByGame.get(g.id) ?? 0,
      createdAt:
         typeof g.createdAt === 'string'
            ? g.createdAt
            : (g.createdAt as Date).toISOString(),
      startedAt:
         g.startedAt == null
            ? null
            : typeof g.startedAt === 'string'
            ? g.startedAt
            : (g.startedAt as Date).toISOString(),
      completedAt:
         g.completedAt == null
            ? null
            : typeof g.completedAt === 'string'
            ? g.completedAt
            : (g.completedAt as Date).toISOString(),
   }));

   return (
      <main className='mx-auto w-full max-w-6xl px-4 py-8 text-[color:var(--color-cream-200)]'>
         <header className='mb-6 flex flex-wrap items-baseline justify-between gap-3'>
            <div>
               <h1 className='font-display text-3xl uppercase tracking-wider'>
                  Admin · Rooms
               </h1>
               <p className='mt-1 text-sm opacity-70'>
                  Signed in as <span className='font-mono'>{admin.email}</span> ·{' '}
                  {data.length} room{data.length === 1 ? '' : 's'}
               </p>
            </div>
         </header>
         <RoomsTable rows={data} />
      </main>
   );
}
