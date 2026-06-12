import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db/client';
import { gameEvents, gamePlayers, games } from './db/schema';
import type { DbGame } from './db/schema';
import { bumpUserStats } from './stats';
import { broadcastRoomState } from './realtime/broadcast';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
import { initialState, reduce } from '@/game/engine';
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
   constructor(public code: 'NOT_FOUND' | 'NOT_MEMBER' | 'INVALID_STATE' | 'FORBIDDEN' | 'CONFLICT', message: string) {
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
   };
}

export type EventType =
   | 'PLAYER_JOIN'
   | 'PLAYER_LEAVE'
   | 'START_GAME'
   | 'DRAW'
   | 'BANK'
   | 'END_TURN'
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
   };
}

type ApplyOptions = {
   actorId?: string;
   code?: string;
   onPlayers?: (tx: Tx, gameId: string, next: GameState) => Promise<void>;
};

export async function applyAction(
   gameId: string,
   action: GameAction,
   eventType: EventType,
   options: ApplyOptions = {},
): Promise<{ next: GameState; eventId: number }> {
   const result = await db.transaction(async (tx) => {
      const row = await tx.query.games.findFirst({ where: eq(games.id, gameId) });
      if (!row) throw new RoomError('NOT_FOUND', 'Game not found');
      const current = parseEngineState(row);
      const next = reduce(current, action);

      await tx
         .update(games)
         .set({
            state: serializeState(next),
            status: next.status,
            startedAt: next.status === 'active' && !row.startedAt ? new Date() : row.startedAt,
            completedAt: next.status === 'complete' ? new Date() : row.completedAt,
            currentPlayerId:
               next.status === 'active'
                  ? (next.players[next.turnIndex]?.id ?? null)
                  : null,
         })
         .where(eq(games.id, gameId));

      if (options.onPlayers) await options.onPlayers(tx, gameId, next);

      // Bump user_stats when the game just transitioned to complete.
      if (row.status !== 'complete' && next.status === 'complete') {
         const contributions = next.players.map((p) => ({
            userId: p.id,
            coins: p.coins,
            isWinner: next.winnerId === p.id,
         }));
         if (contributions.length > 0) {
            await bumpUserStats(tx, contributions);
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
            },
         })
         .returning({ id: gameEvents.id });

      const event = inserted[0];
      if (!event) throw new Error('Failed to insert game event');
      return { next, eventId: event.id, code: row.code as string | null };
   });

   const code = options.code ?? result.code;
   if (code) {
      await broadcastRoomState(code, {
         state: toPublic(result.next),
         actorId: options.actorId ?? null,
         eventType,
      });
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
