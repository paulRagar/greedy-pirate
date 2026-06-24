import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from './db/client';
import { parseRows } from './db/parseRows';
import { gameEvents, gamePlayers, games } from './db/schema';
import type { DbGame } from './db/schema';
import { bumpUserStats } from './stats';
import { recordVoyage } from './voyages';
import { broadcastLobbyEvent, broadcastRoomState } from './realtime/broadcast';
import { fetchSpectators, promoteSpectators } from './spectators';
import { CONTINUATION_WINDOW_MS, fetchContinuation } from './continuation';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
import { initialState, reduce } from '@/game/engine';
import { PIRATE_PASS_MS, TURN_CLOCK_MS } from '@/game/rules';
import { toPublic } from '@/game/public';
import type { PublicGameState } from '@/game/public';
import type { DeckVariant, GameAction, GameState } from '@/game/types';
export { broadcastRoomState } from './realtime/broadcast';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;

export function generateRoomCode(len = CODE_LEN): string {
   const buf = new Uint32Array(len);
   crypto.getRandomValues(buf);
   let out = '';
   for (let i = 0; i < len; i++) {
      out += CODE_ALPHABET[(buf[i] as number) % CODE_ALPHABET.length];
   }
   return out;
}

export class RoomError extends Error {
   constructor(
      public code: 'NOT_FOUND' | 'NOT_MEMBER' | 'INVALID_STATE' | 'FORBIDDEN' | 'CONFLICT' | 'STALE',
      message: string,
   ) {
      super(message);
      this.name = 'RoomError';
   }
}

export function parseEngineState(row: DbGame): GameState {
   const raw = (row.state ?? {}) as Partial<GameState>;
   return {
      status: row.status as GameState['status'],
      players: (raw.players ?? []) as GameState['players'],
      turnIndex: raw.turnIndex ?? 0,
      deck: (raw.deck ?? []) as GameState['deck'],
      currentCard: raw.currentCard ?? null,
      currentStreak: (raw.currentStreak ?? []) as GameState['currentStreak'],
      pirateCount: raw.pirateCount ?? 0,
      variant: row.deckVariant as DeckVariant,
      winnerId: raw.winnerId ?? null,
      absentIds: (raw.absentIds ?? []) as GameState['absentIds'],
      telemetry: (raw.telemetry ?? {}) as GameState['telemetry'],
      rngSeed: raw.rngSeed ?? '',
      rngCursor: raw.rngCursor ?? 0,
      amuletArmed: raw.amuletArmed ?? false,
      multiplierRemaining: raw.multiplierRemaining ?? 0,
      bankLocked: raw.bankLocked ?? false,
      pendingDecision: raw.pendingDecision ?? null,
      daveyToss: raw.daveyToss ?? null,
   };
}

export type EventType =
   | 'PLAYER_JOIN'
   | 'PLAYER_LEAVE'
   | 'START_GAME'
   | 'DRAW'
   | 'RESOLVE_MULTIPLIER'
   | 'BANK'
   | 'END_TURN'
   | 'SKIP_TURN'
   | 'MARK_PRESENT'
   | 'TIMEOUT_TURN'
   | 'MARK_ABSENT'
   | 'GAME_ENDED';

export type EventPayload = {
   state: PublicGameState;
   actorId?: string;
};

export async function findGameByCode(code: string): Promise<DbGame | null> {
   const row = await db.query.games.findFirst({
      where: and(eq(games.code, code.toUpperCase()), sql`${games.status} in ('lobby', 'active')`),
   });
   return row ?? null;
}

export async function findCompletedOrActiveGame(code: string): Promise<DbGame | null> {
   const row = await db.query.games.findFirst({
      where: eq(games.code, code.toUpperCase()),
   });
   return row ?? null;
}

// `max(seq)` is null on an empty event log; postgres-js may hand back a
// bigint aggregate as a string, so accept both before the Number() coercion.
const MaxSeqRow = z.object({ max_seq: z.union([z.number(), z.string(), z.null()]) });

/**
 * Highest `game_events.seq` for a game — the version of its latest broadcast.
 * Returned to the client as `initialVersion` so a resume / RSC refresh only
 * replaces realtime state when the fetched snapshot is genuinely newer.
 * Returns -1 when no events exist yet (fresh lobby).
 */
export async function latestEventSeq(gameId: string): Promise<number> {
   const rows = parseRows(
      await db.execute(sql`select max(seq) as max_seq from ${gameEvents} where game_id = ${gameId}`),
      MaxSeqRow,
   );
   const maxSeq = rows[0]?.max_seq;
   if (maxSeq === null || maxSeq === undefined) return -1;
   return Number(maxSeq);
}

export async function isUserInGame(gameId: string, userId: string): Promise<boolean> {
   const row = await db.query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, userId)),
      columns: { id: true },
   });
   return !!row;
}

export async function loadRoomForUser(code: string, userId: string) {
   const game = await findCompletedOrActiveGame(code);
   if (!game) throw new RoomError('NOT_FOUND', 'Room not found');
   const isHost = game.hostId === userId;
   const member = await isUserInGame(game.id, userId);
   if (!isHost && !member) throw new RoomError('NOT_MEMBER', 'Not a member of this room');
   return { game, isHost };
}

export async function createRoom(params: {
   hostId: string;
   variant: DeckVariant;
   isPublic?: boolean;
}): Promise<DbGame> {
   for (let attempt = 0; attempt < 6; attempt++) {
      const code = generateRoomCode();
      try {
         const [row] = await db
            .insert(games)
            .values({
               code,
               hostId: params.hostId,
               mode: 'online',
               deckVariant: params.variant,
               status: 'lobby',
               isPublic: params.isPublic ?? false,
               state: serializeState({ ...initialState, variant: params.variant }),
            })
            .returning();
         if (row) return row;
      } catch (err) {
         if (isUniqueViolation(err)) continue;
         throw err;
      }
   }
   throw new RoomError('CONFLICT', 'Could not allocate a unique room code');
}

function isUniqueViolation(err: unknown): boolean {
   return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: unknown }).code === '23505'
   );
}

function serializeState(state: GameState): Record<string, unknown> {
   return {
      players: state.players,
      turnIndex: state.turnIndex,
      deck: state.deck,
      currentCard: state.currentCard,
      currentStreak: state.currentStreak,
      pirateCount: state.pirateCount,
      winnerId: state.winnerId,
      absentIds: state.absentIds,
      telemetry: state.telemetry,
      rngSeed: state.rngSeed,
      rngCursor: state.rngCursor,
      amuletArmed: state.amuletArmed,
      multiplierRemaining: state.multiplierRemaining,
      bankLocked: state.bankLocked,
      pendingDecision: state.pendingDecision,
      daveyToss: state.daveyToss,
   };
}

type ApplyOptions = {
   actorId?: string;
   code?: string;
   onPlayers?: (tx: Tx, gameId: string, next: GameState) => Promise<void>;
   /**
    * Runs against the *locked* current state, before the action is reduced.
    * Throw a `RoomError` to reject (e.g. turn ownership). This is the
    * authoritative precondition check — any check done before calling
    * `applyAction` is advisory only, since the row can change between that
    * read and the lock being acquired here.
    */
   guard?: (current: GameState, row: DbGame) => void;
};

export async function applyAction(
   gameId: string,
   action: GameAction,
   eventType: EventType,
   options: ApplyOptions = {},
): Promise<{ next: GameState; eventId: number }> {
   const result = await db.transaction(async (tx) => {
      // Lock the game row for the whole read-modify-write. Without this,
      // two concurrent actions on the same room both read the same state,
      // both reduce, and the second UPDATE clobbers the first (lost update).
      // FOR UPDATE serializes them: the second waits, then reads the
      // already-committed state and reduces against fresh data.
      const [row] = await tx
         .select()
         .from(games)
         .where(eq(games.id, gameId))
         .for('update')
         .limit(1);
      if (!row) throw new RoomError('NOT_FOUND', 'Game not found');
      const current = parseEngineState(row);
      // Authoritative precondition check against the locked state.
      options.guard?.(current, row);
      let next = reduce(current, action);

      const justCompleted = row.status !== 'complete' && next.status === 'complete';

      // Stamp a fresh shot-clock deadline whenever the helm changes hands or
      // the holder draws (a draw keeps the turn but resets the clock). Other
      // actions preserve the running deadline so an unrelated broadcast (a
      // reconnect, a spectator join) can't silently extend the current
      // player's clock. Null whenever the game isn't active.
      const prevHolderId =
         row.status === 'active' ? (current.players[current.turnIndex]?.id ?? null) : null;
      const nextHolderId =
         next.status === 'active' ? (next.players[next.turnIndex]?.id ?? null) : null;
      const resetClock =
         next.status === 'active' && (nextHolderId !== prevHolderId || action.type === 'DRAW');
      // A revealed pirate carries no decision — pass on a short fuse instead of
      // the full turn clock. (Only ever set on the pirate-revealing DRAW; the
      // next holder's turn resets to the full clock.)
      // A pirate, or a Davey Jones whose toss was LOST, reveals a no-decision
      // card that just hands off — give it the short fuse. A winning Davey toss
      // keeps the turn live, so it gets the full clock like any active turn.
      const turnEnderRevealed =
         next.currentCard?.kind === 'pirate' ||
         (next.currentCard?.kind === 'davey_jones' && !next.daveyToss?.won);
      const clockMs = turnEnderRevealed ? PIRATE_PASS_MS : TURN_CLOCK_MS;
      const turnDeadline =
         next.status !== 'active'
            ? null
            : resetClock
              ? new Date(Date.now() + clockMs)
              : (row.turnDeadline ?? new Date(Date.now() + clockMs));

      let unlocks: Record<string, string[]> = {};
      await tx
         .update(games)
         .set({
            state: serializeState(next),
            status: next.status,
            startedAt: next.status === 'active' && !row.startedAt ? new Date() : row.startedAt,
            completedAt: next.status === 'complete' ? new Date() : row.completedAt,
            continuationDeadline: justCompleted
               ? new Date(Date.now() + CONTINUATION_WINDOW_MS)
               : row.continuationDeadline,
            continuationFinalized: justCompleted ? false : row.continuationFinalized,
            currentPlayerId:
               next.status === 'active'
                  ? (next.players[next.turnIndex]?.id ?? null)
                  : null,
            turnDeadline,
         })
         .where(eq(games.id, gameId));

      if (options.onPlayers) await options.onPlayers(tx, gameId, next);

      // Bump user_stats when the game just transitioned to complete.
      // Compute these BEFORE promoting spectators so freshly seated folks
      // don't get a games_played++ for a round they didn't play.
      if (justCompleted) {
         const contributions = next.players.map((p) => {
            const t = next.telemetry[p.id];
            return {
               userId: p.id,
               coins: p.coins,
               isWinner: next.winnerId === p.id,
               maxStreakLength: t?.maxStreakLength ?? 0,
               biggestBank: t?.biggestBank ?? 0,
               piratesEncountered: t?.piratesEncountered ?? 0,
            };
         });
         if (contributions.length > 0) {
            unlocks = await bumpUserStats(tx, contributions);
         }

         // Archive an immutable voyage record now, while `next.players` still
         // reflects who actually played — before spectator promotion mutates
         // the roster and before the continuation flow recycles this row.
         await recordVoyage(tx, {
            code: row.code as string,
            deckVariant: row.deckVariant,
            state: next,
         });

         // Promote FIFO spectators into open seats so they get a chance to
         // opt into the continuation window. Promoted players need to
         // click Continue too — their continued_at starts null.
         const promoted = await promoteSpectators(tx, gameId, next.players);
         if (promoted.length !== next.players.length) {
            next = { ...next, players: [...promoted] };
            await tx
               .update(games)
               .set({ state: serializeState(next) })
               .where(eq(games.id, gameId));
         }
      }

      const seq = await nextSeq(tx, gameId);

      const inserted = await tx
         .insert(gameEvents)
         .values({
            gameId,
            seq,
            actorId: options.actorId ?? null,
            type: eventType,
            payload: {
               state: toPublic(next),
               actorId: options.actorId ?? null,
               ...(Object.keys(unlocks).length > 0 ? { unlocks } : {}),
            },
         })
         .returning({ id: gameEvents.id });

      const event = inserted[0];
      if (!event) throw new Error('Failed to insert game event');
      const spectators = await fetchSpectators(tx, gameId);
      const continuation = await fetchContinuation(tx, gameId);
      return {
         next,
         eventId: event.id,
         seq,
         code: row.code as string | null,
         isPublic: row.isPublic,
         prevStatus: row.status,
         spectators,
         continuation,
         unlocks,
         turnDeadline,
      };
   });

   const code = options.code ?? result.code;
   if (code) {
      await broadcastRoomState(code, {
         state: toPublic(result.next),
         spectators: result.spectators,
         actorId: options.actorId ?? null,
         eventType,
         version: result.seq,
         continuation: result.continuation,
         turnDeadline: result.turnDeadline ? result.turnDeadline.toISOString() : null,
         ...(Object.keys(result.unlocks).length > 0 ? { unlocks: result.unlocks } : {}),
      });
      if (result.isPublic) {
         revalidatePath('/play/lobby');
         const stillListable =
            result.next.status === 'lobby' || result.next.status === 'active';
         if (stillListable) {
            await broadcastLobbyEvent({
               type: 'room_updated',
               code,
               playerCount: result.next.players.length,
               status: result.next.status as 'lobby' | 'active',
            });
         } else if (result.prevStatus === 'lobby' || result.prevStatus === 'active') {
            await broadcastLobbyEvent({ type: 'room_removed', code });
         }
      }
   }

   return { next: result.next, eventId: result.eventId };
}

async function nextSeq(tx: Tx, gameId: string): Promise<number> {
   const result = await tx.execute<{ next_seq: number }>(
      sql`select coalesce(max(seq), -1) + 1 as next_seq from ${gameEvents} where game_id = ${gameId}`,
   );
   const row = result[0] as { next_seq: number | string } | undefined;
   if (!row) return 0;
   return Number(row.next_seq);
}

export function isPlayerTurn(state: GameState, userId: string): boolean {
   const seat = state.players[state.turnIndex];
   return !!seat && seat.id === userId;
}

export { games, gamePlayers, gameEvents };
export { fetchSpectators } from './spectators';
