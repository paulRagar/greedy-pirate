import { NextResponse, type NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { games } from '@/server/db/schema';
import {
   broadcastKnockResolved,
   broadcastLobbyEvent,
   broadcastRoomState,
} from '@/server/realtime/broadcast';
import { findGameByCode, parseEngineState } from '@/server/game-room';
import { fetchSpectators } from '@/server/spectators';
import { finalizeContinuationCore } from '@/server/actions/finalizeContinuation';
import { isValidBearer } from '@/server/auth/bearerToken';
import { toPublic } from '@/game/public';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AbandonRow = { abandoned_lobbies: number; abandoned_active: number };
type ExpireRow = { game_code: string; request_id: string; requester_id: string };
type MigrateRow = { game_code: string; new_host_id: string };

function authorize(req: NextRequest): boolean {
   return isValidBearer(req.headers.get('authorization'), process.env.CRON_SECRET);
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

      const purgeRows = (await db.execute<{ purge_old_games: number }>(
         sql`select public.purge_old_games() as purge_old_games`,
      )) as unknown as Array<{ purge_old_games: number }>;
      const purgedGames = Number(purgeRows[0]?.purge_old_games ?? 0);

      const expiredRows = (await db.execute<ExpireRow>(
         sql`select * from public.expire_pending_join_requests()`,
      )) as unknown as ExpireRow[];
      for (const row of expiredRows) {
         await broadcastKnockResolved(row.game_code, {
            requestId: row.request_id,
            requesterId: row.requester_id,
            outcome: 'expired',
         });
      }

      const migratedRows = (await db.execute<MigrateRow>(
         sql`select * from public.migrate_orphan_hosts()`,
      )) as unknown as MigrateRow[];
      for (const row of migratedRows) {
         const game = await findGameByCode(row.game_code);
         if (!game) continue;
         const state = parseEngineState(game);
         const spectators = await fetchSpectators(db, game.id);
         await broadcastRoomState(row.game_code, {
            state: toPublic(state),
            spectators,
            actorId: row.new_host_id,
            eventType: 'HOST_CHANGED',
         });
         if (game.isPublic) {
            await broadcastLobbyEvent({
               type: 'room_updated',
               code: row.game_code,
               playerCount: state.players.length,
               status: game.status as 'lobby' | 'active',
            });
         }
      }

      // Safety net for the post-game continuation window — if no client
      // fired finalize before its tab closed, sweep it here.
      const staleContinuations = (await db.execute<{ game_code: string }>(
         sql`select * from public.find_expired_continuations()`,
      )) as unknown as Array<{ game_code: string }>;
      let finalizedContinuations = 0;
      for (const row of staleContinuations) {
         const game = await db.query.games.findFirst({
            where: eq(games.code, row.game_code),
         });
         if (!game) continue;
         const res = await finalizeContinuationCore(row.game_code, game.hostId);
         if (res.ok && res.finalized) finalizedContinuations += 1;
      }

      return NextResponse.json({
         ok: true,
         abandonedLobbies: Number(abandon.abandoned_lobbies ?? 0),
         abandonedActive: Number(abandon.abandoned_active ?? 0),
         prunedEvents,
         purgedGames,
         expiredKnocks: expiredRows.length,
         migratedHosts: migratedRows.length,
         finalizedContinuations,
         ranAt: new Date().toISOString(),
      });
   } catch (err) {
      console.error('[cron/cleanup] failed', err);
      return NextResponse.json({ ok: false, error: 'cleanup failed' }, { status: 500 });
   }
}
