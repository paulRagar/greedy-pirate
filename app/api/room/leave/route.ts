import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { gamePlayers, games, gameSpectators } from '@/server/db/schema';
import {
   applyAction,
   findCompletedOrActiveGame,
   parseEngineState,
} from '@/server/game-room';
import {
   broadcastLobbyEvent,
   broadcastRoomState,
} from '@/server/realtime/broadcast';
import { fetchSpectators } from '@/server/spectators';
import { toPublic } from '@/game/public';
import { getSupabaseServer } from '@/server/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Beacon-driven exit. `navigator.sendBeacon` cannot read responses, so
 * this route returns 204 regardless of internal failures. Tab-close +
 * page-hide both POST here so a room cleans up before the cron sweep
 * eventually catches it.
 */
export async function POST(req: NextRequest) {
   try {
      const supabase = await getSupabaseServer();
      const {
         data: { user },
      } = await supabase.auth.getUser();
      if (!user) return new NextResponse(null, { status: 204 });

      const raw = await req.text();
      const body = raw ? JSON.parse(raw) : null;
      const code: string | undefined = body?.code;
      if (!code) return new NextResponse(null, { status: 204 });
      const upper = code.toUpperCase();

      const game = await findCompletedOrActiveGame(upper);
      if (!game?.code) return new NextResponse(null, { status: 204 });

      // Spectator path — drop the spectator row, broadcast roster.
      const spectatorRow = await db.query.gameSpectators.findFirst({
         where: and(
            eq(gameSpectators.gameId, game.id),
            eq(gameSpectators.userId, user.id),
         ),
      });
      if (spectatorRow) {
         await db
            .delete(gameSpectators)
            .where(
               and(eq(gameSpectators.gameId, game.id), eq(gameSpectators.userId, user.id)),
            );
         const state = parseEngineState(game);
         const spectators = await fetchSpectators(db, game.id);
         await broadcastRoomState(upper, {
            state: toPublic(state),
            spectators,
            actorId: user.id,
            eventType: 'SPECTATOR_LEAVE',
         });
         return new NextResponse(null, { status: 204 });
      }

      const seat = await db.query.gamePlayers.findFirst({
         where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)),
      });
      if (!seat) return new NextResponse(null, { status: 204 });

      const isHost = game.hostId === user.id;

      if (game.status === 'lobby') {
         // Drop their seat + run PLAYER_LEAVE through the engine.
         await db
            .delete(gamePlayers)
            .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)));
         try {
            await applyAction(
               game.id,
               { type: 'PLAYER_LEAVE', playerId: user.id },
               'PLAYER_LEAVE',
               { actorId: user.id, code: upper },
            );
         } catch (err) {
            console.error('[room/leave] applyAction failed', err);
         }

         // Re-read post-leave state. If the lobby is now empty, abandon it
         // so the Find Crew list drops it immediately.
         const refreshed = await db.query.games.findFirst({ where: eq(games.id, game.id) });
         if (refreshed) {
            const state = parseEngineState(refreshed);
            if (state.players.length === 0) {
               await db
                  .update(games)
                  .set({ status: 'abandoned' })
                  .where(eq(games.id, game.id));
               if (refreshed.isPublic) {
                  await broadcastLobbyEvent({ type: 'room_removed', code: upper });
               }
            } else if (isHost) {
               // Host bailed without nominating — flag for the cron-driven
               // host migration to pick the earliest joiner.
               await db
                  .update(games)
                  .set({ hostLeftAt: new Date() })
                  .where(eq(games.id, game.id));
            }
         }
         return new NextResponse(null, { status: 204 });
      }

      // Active game — engine PLAYER_LEAVE asserts lobby. Don't yank the seat;
      // mark them absent via SKIP_TURN if it's their turn, and mark host gone
      // so cron migrates the wheel.
      if (isHost) {
         await db
            .update(games)
            .set({ hostLeftAt: new Date() })
            .where(eq(games.id, game.id));
      }
      return new NextResponse(null, { status: 204 });
   } catch (err) {
      console.error('[room/leave] failed', err);
      return new NextResponse(null, { status: 204 });
   }
}
