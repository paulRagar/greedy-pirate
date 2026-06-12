'use server';

import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { applyAction, findGameByCode, isPlayerTurn, parseEngineState } from '@/server/game-room';
import { db } from '@/server/db/client';
import { gamePlayers } from '@/server/db/schema';
import type { GameAction } from '@/game/types';
import { getSupabaseServer } from '@/server/supabase/server';

const InputSchema = z.object({
   code: z.string().trim().toUpperCase().length(4),
});

const SkipSchema = InputSchema.extend({
   expectedTurnPlayerId: z.string().uuid(),
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

/**
 * Caller has just reconnected — clear their absent flag so future turn
 * advances stop bypassing their seat. Idempotent and seated-only.
 */
export async function markPresentOnline(input: { code: string }): Promise<TurnResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findGameByCode(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.status !== 'active') return { ok: true };

   const state = parseEngineState(game);
   if (!state.absentIds.includes(user.id)) return { ok: true };

   try {
      await applyAction(
         game.id,
         { type: 'MARK_PRESENT', playerId: user.id },
         'MARK_PRESENT',
         { actorId: user.id, code: parsed.data.code },
      );
   } catch (err) {
      console.error('markPresentOnline failed', err);
      return { ok: false, error: 'Mark present failed' };
   }

   return { ok: true };
}

/**
 * Skip the current turn when the player who holds it has disconnected.
 *
 * Any seated player may call this — multiple clients detecting the same
 * dropout may race, so the action is idempotent: if the engine state's
 * current turn-holder no longer matches `expectedTurnPlayerId`, the
 * server returns ok without applying.
 *
 * Spectators and non-seated callers are rejected to keep griefing
 * out-of-reach.
 */
export async function skipAbsentTurn(input: {
   code: string;
   expectedTurnPlayerId: string;
}): Promise<TurnResult> {
   const parsed = SkipSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findGameByCode(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.status !== 'active') return { ok: false, error: 'Game not active' };

   const seated = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)),
   });
   if (!seated) return { ok: false, error: 'Only seated players can skip a turn' };

   const state = parseEngineState(game);
   const current = state.players[state.turnIndex];
   if (!current || current.id !== parsed.data.expectedTurnPlayerId) {
      // Turn already moved on — idempotent no-op.
      return { ok: true };
   }
   if (current.id === user.id) {
      return { ok: false, error: 'You hold the helm — bank or draw instead' };
   }

   try {
      await applyAction(
         game.id,
         { type: 'SKIP_TURN', playerId: current.id },
         'SKIP_TURN',
         { actorId: user.id, code: parsed.data.code },
      );
   } catch (err) {
      console.error('skipAbsentTurn failed', err);
      return { ok: false, error: 'Skip failed' };
   }

   return { ok: true };
}
