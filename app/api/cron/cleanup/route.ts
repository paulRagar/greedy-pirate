import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AbandonRow = { abandoned_lobbies: number; abandoned_active: number };

function authorize(req: NextRequest): boolean {
   const secret = process.env.CRON_SECRET;
   if (!secret) return false;
   const header = req.headers.get('authorization');
   if (!header) return false;
   return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
   if (!authorize(req)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
   }

   try {
      const abandonRows = (await db.execute<AbandonRow>(
         sql`select * from public.abandon_stale_games()`,
      )) as unknown as AbandonRow[];
      const abandon = abandonRows[0] ?? { abandoned_lobbies: 0, abandoned_active: 0 };

      const pruneRows = (await db.execute<{ prune_old_events: number }>(
         sql`select public.prune_old_events() as prune_old_events`,
      )) as unknown as Array<{ prune_old_events: number }>;
      const prunedEvents = Number(pruneRows[0]?.prune_old_events ?? 0);

      return NextResponse.json({
         ok: true,
         abandonedLobbies: Number(abandon.abandoned_lobbies ?? 0),
         abandonedActive: Number(abandon.abandoned_active ?? 0),
         prunedEvents,
         ranAt: new Date().toISOString(),
      });
   } catch (err) {
      console.error('[cron/cleanup] failed', err);
      return NextResponse.json({ ok: false, error: 'cleanup failed' }, { status: 500 });
   }
}
