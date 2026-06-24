'use server';

import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { applyAction, findGameByCode, isPlayerTurn, parseEngineState, RoomError } from '@/server/game-room';
import type { Tx } from '@/server/game-room';
import { db } from '@/server/db/client';
import { gamePlayers } from '@/server/db/schema';
import { EngineError } from '@/game/engine';
import { SPYGLASS_PEEK } from '@/game/rules';
import type { Card, GameAction, GameState } from '@/game/types';
import { getSupabaseServer } from '@/server/supabase/server';

/**
 * Mirror engine player coins/flags into the `game_players` rows after an
 * action. Shared by every turn action so cross-player changes (Monkey theft,
 * Davey Jones tosses) persist to the queryable mirror, not just `games.state`.
 */
async function writePlayers(tx: Tx, gameId: string, next: GameState): Promise<void> {
   for (const player of next.players) {
      await tx
         .update(gamePlayers)
         .set({
            coins: player.coins,
            isWinner: next.winnerId === player.id,
            piratesEncountered: next.telemetry[player.id]?.piratesEncountered ?? 0,
         })
         .where(sql`${gamePlayers.gameId} = ${gameId} and ${gamePlayers.userId} = ${player.id}`);
   }
}

/**
 * Map an error thrown out of `applyAction` to a `TurnResult`.
 * - `RoomError('STALE')` → the action raced and is now a no-op; report success.
 * - other `RoomError` / `EngineError` → a real precondition failure; surface its message.
 * - anything else → unexpected; log it and return a generic failure.
 */
function toTurnResult(err: unknown, context: string): TurnResult {
   if (err instanceof RoomError) {
      if (err.code === 'STALE') return { ok: true };
      return { ok: false, error: err.message };
   }
   if (err instanceof EngineError) return { ok: false, error: err.message };
   console.error(`${context} failed`, err);
   return { ok: false, error: 'Action failed' };
}

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

   // Advisory fast-path check (avoids opening a transaction for the common
   // "not your turn" case). The authoritative check is the guard below, which
   // runs against the locked row inside the transaction.
   const state = parseEngineState(game);
   if (!isPlayerTurn(state, user.id)) return { ok: false, error: 'Not your turn' };

   try {
      await applyAction(game.id, action, eventType, {
         actorId: user.id,
         code: parsed.data.code,
         guard: (current) => {
            if (!isPlayerTurn(current, user.id)) {
               throw new RoomError('FORBIDDEN', 'Not your turn');
            }
         },
         onPlayers: writePlayers,
      });
   } catch (err) {
      return toTurnResult(err, `dispatch ${eventType}`);
   }

   return { ok: true };
}

/** DRAW carries a private Spyglass peek back to the actor only — never broadcast. */
export type DrawResult = { ok: true; peek?: Card[] } | { ok: false; error: string };

export async function drawOnline(code: string): Promise<DrawResult> {
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
      const { next } = await applyAction(game.id, { type: 'DRAW' }, 'DRAW', {
         actorId: user.id,
         code: parsed.data.code,
         guard: (current) => {
            if (!isPlayerTurn(current, user.id)) throw new RoomError('FORBIDDEN', 'Not your turn');
         },
         onPlayers: writePlayers,
      });
      // Spyglass: hand the actor the next few cards privately. The deck is never
      // in the broadcast, so the peek can only reach the player who drew it.
      if (next.currentCard?.kind === 'spyglass') {
         return { ok: true, peek: next.deck.slice(0, SPYGLASS_PEEK) };
      }
      return { ok: true };
   } catch (err) {
      return toTurnResult(err, 'dispatch DRAW');
   }
}

export async function resolveMultiplierOnline(code: string, secure: boolean): Promise<TurnResult> {
   return dispatch(code, { type: 'RESOLVE_MULTIPLIER', secure }, 'RESOLVE_MULTIPLIER');
}

export async function bankOnline(code: string): Promise<TurnResult> {
   return dispatch(code, { type: 'BANK' }, 'BANK');
}

export async function endTurnOnline(code: string): Promise<TurnResult> {
   return dispatch(code, { type: 'END_TURN' }, 'END_TURN');
}

/**
 * Caller is explicitly leaving an active game (back button, logo, etc).
 * Mark them absent immediately so the table skips their seat right away —
 * without this, everyone waits out the ~10s presence grace before the
 * skip-leader notices, and the helm can even land on the empty seat first.
 * Seated + active only; idempotent.
 */
export async function leaveActiveGame(input: { code: string }): Promise<TurnResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const game = await findGameByCode(parsed.data.code);
   if (!game) return { ok: false, error: 'Room not found' };
   if (game.status !== 'active') return { ok: true }; // lobby/complete leave handled elsewhere

   const seated = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, user.id)),
   });
   if (!seated) return { ok: true };

   const state = parseEngineState(game);
   if (state.absentIds.includes(user.id)) return { ok: true };

   try {
      await applyAction(
         game.id,
         { type: 'MARK_ABSENT', playerId: user.id },
         'MARK_ABSENT',
         { actorId: user.id, code: parsed.data.code },
      );
   } catch (err) {
      return toTurnResult(err, 'leaveActiveGame');
   }

   return { ok: true };
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

   // Advisory pre-checks (cheap rejects before opening a transaction). The
   // authoritative versions run in the guard against the locked row, so two
   // clients racing to skip the same absent player can't double-advance.
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
         { type: 'SKIP_TURN', playerId: parsed.data.expectedTurnPlayerId },
         'SKIP_TURN',
         {
            actorId: user.id,
            code: parsed.data.code,
            guard: (locked) => {
               const holder = locked.players[locked.turnIndex];
               if (!holder || holder.id !== parsed.data.expectedTurnPlayerId) {
                  // Another client already skipped/advanced this turn.
                  throw new RoomError('STALE', 'Turn already advanced');
               }
               if (holder.id === user.id) {
                  throw new RoomError('FORBIDDEN', 'You hold the helm — bank or draw instead');
               }
            },
         },
      );
   } catch (err) {
      return toTurnResult(err, 'skipAbsentTurn');
   }

   return { ok: true };
}

/**
 * The shot clock expired on the current turn — auto-resolve it (bank a
 * standing streak, otherwise pass with no coins) and advance. Unlike
 * {@link skipAbsentTurn} this does NOT mark the player absent: a slow but
 * connected player keeps their seat and gets a fresh clock next turn.
 *
 * Any seated player (including the current holder's own client) may call it,
 * so multiple clients racing on the same expiry is fine — the action is
 * idempotent on the holder match. Crucially, the server re-checks the deadline
 * against the *locked* row: a client cannot end someone's turn early, only
 * after the clock has genuinely run out.
 */
export async function timeoutTurn(input: {
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
   if (!seated) return { ok: false, error: 'Only seated players can time out a turn' };

   // Advisory pre-check (cheap reject). The authoritative holder + deadline
   // checks run in the guard against the locked row.
   const state = parseEngineState(game);
   const current = state.players[state.turnIndex];
   if (!current || current.id !== parsed.data.expectedTurnPlayerId) {
      // Turn already moved on — idempotent no-op.
      return { ok: true };
   }

   try {
      await applyAction(
         game.id,
         { type: 'TIMEOUT_TURN', playerId: parsed.data.expectedTurnPlayerId },
         'TIMEOUT_TURN',
         {
            actorId: user.id,
            code: parsed.data.code,
            guard: (locked, row) => {
               const holder = locked.players[locked.turnIndex];
               if (!holder || holder.id !== parsed.data.expectedTurnPlayerId) {
                  throw new RoomError('STALE', 'Turn already advanced');
               }
               // Enforce the clock server-side — refuse to cut a turn short
               // before its deadline. A null deadline means no clock is armed.
               if (!row.turnDeadline || row.turnDeadline.getTime() > Date.now()) {
                  throw new RoomError('STALE', 'Turn clock has not expired');
               }
            },
         },
      );
   } catch (err) {
      return toTurnResult(err, 'timeoutTurn');
   }

   return { ok: true };
}
