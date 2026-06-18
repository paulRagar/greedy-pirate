import { NextResponse, type NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { parseRows } from '@/server/db/parseRows';
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

const AbandonRow = z.object({ abandoned_lobbies: z.number(), abandoned_active: z.number() });
const PruneRow = z.object({ prune_old_events: z.number() });
const PurgeRow = z.object({ purge_old_games: z.number() });
const ExpireRow = z.object({
   game_code: z.string(),
   request_id: z.string(),
   requester_id: z.string(),
});
const MigrateRow = z.object({ game_code: z.string(), new_host_id: z.string() });
const ContinuationRow = z.object({ game_code: z.string() });

function authorize(req: NextRequest): boolean {
   return isValidBearer(req.headers.get('authorization'), process.env.CRON_SECRET);
}

export async function GET(req: NextRequest) {
   if (!authorize(req)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
   }

   try {
      const abandonRows = parseRows(
         await db.execute(sql`select * from public.abandon_stale_games()`),
         AbandonRow,
      );
      const abandon = abandonRows[0] ?? { abandoned_lobbies: 0, abandoned_active: 0 };

      const pruneRows = parseRows(
         await db.execute(sql`select public.prune_old_events() as prune_old_events`),
         PruneRow,
      );
      const prunedEvents = pruneRows[0]?.prune_old_events ?? 0;

      const purgeRows = parseRows(
         await db.execute(sql`select public.purge_old_games() as purge_old_games`),
         PurgeRow,
      );
      const purgedGames = purgeRows[0]?.purge_old_games ?? 0;

      const expiredRows = parseRows(
         await db.execute(sql`select * from public.expire_pending_join_requests()`),
         ExpireRow,
      );
      for (const row of expiredRows) {
         await broadcastKnockResolved({
            requestId: row.request_id,
            requesterId: row.requester_id,
            outcome: 'expired',
         });
      }

      const migratedRows = parseRows(
         await db.execute(sql`select * from public.migrate_orphan_hosts()`),
         MigrateRow,
      );
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
      const staleContinuations = parseRows(
         await db.execute(sql`select * from public.find_expired_continuations()`),
         ContinuationRow,
      );
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
         abandonedLobbies: abandon.abandoned_lobbies,
         abandonedActive: abandon.abandoned_active,
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
