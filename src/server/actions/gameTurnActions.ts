'use server';

import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { applyAction, findGameByCode, isPlayerTurn, parseEngineState } from '@/server/game-room';
import { gamePlayers } from '@/server/db/schema';
import type { GameAction } from '@/game/types';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

export type TurnResult = { ok: true } | { ok: false; error: string };

async function dispatch(code: string, action: GameAction, eventType: Parameters<typeof applyAction>[2]): Promise<TurnResult> {
   const parsed = InputSchema.safeParse({ code });
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findGameByCode(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.status !== 'active') return { ok: false, error: 'Game not active' };

   const state = parseEngineState(game);
   if (!isPlayerTurn(state, user.id)) return { ok: false, error: 'Not your turn' };

   try {
      await applyAction(game.id, action, eventType, {
         actorId: user.id,
         code: parsed.data.code,
         onPlayers: async (tx, gameId, next) => {
            for (const player of next.players) {
               await tx
                  .update(gamePlayers)
                  .set({
                     coins: player.coins,
                     isWinner: next.winnerId === player.id,
                  })
                  .where(
                     sql`${gamePlayers.gameId} = ${gameId} and ${gamePlayers.userId} = ${player.id}`,
                  );
            }
         },
      });
   } catch (err) {
      console.error(`dispatch ${eventType} failed`, err);
      return { ok: false, error: 'Action failed' };
   }

   return { ok: true };
}

export async function drawOnline(code: string): Promise<TurnResult> {
   return dispatch(code, { type: 'DRAW' }, 'DRAW');
}

export async function bankOnline(code: string): Promise<TurnResult> {
   return dispatch(code, { type: 'BANK' }, 'BANK');
}

export async function endTurnOnline(code: string): Promise<TurnResult> {
   return dispatch(code, { type: 'END_TURN' }, 'END_TURN');
}
