import 'server-only';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from './db/client';
import { voyagePlayers, voyages } from './db/schema';
import type { DbVoyagePlayer } from './db/schema';
import type { GameState } from '@/game/types';

type Tx = Parameters<Parameters<(typeof import('./db/client'))['db']['transaction']>[0]>[0];

/**
 * Archive a finished online game into the immutable voyage log. Called from the
 * `justCompleted` branch of `applyAction`, before the live `games` row is
 * recycled by the continuation/restart flow. Captures each player's final
 * result plus the per-player telemetry already tracked by the engine.
 */
export async function recordVoyage(
   tx: Tx,
   params: { code: string; deckVariant: string; state: GameState },
): Promise<void> {
   const { code, deckVariant, state } = params;
   if (state.players.length === 0) return;

   // Rank by coins desc — same ordering the engine uses to pick the winner.
   const ranked = [...state.players].sort((a, b) => b.coins - a.coins);
   const winner = ranked.find((p) => p.id === state.winnerId) ?? null;

   const [voyage] = await tx
      .insert(voyages)
      .values({
         code,
         deckVariant,
         playerCount: state.players.length,
         winnerUserId: winner?.id ?? null,
         winnerName: winner?.name ?? null,
      })
      .returning({ id: voyages.id });

   if (!voyage) return;

   await tx.insert(voyagePlayers).values(
      ranked.map((player, index) => {
         const t = state.telemetry[player.id];
         return {
            voyageId: voyage.id,
            userId: player.id,
            displayName: player.name,
            placement: index + 1,
            coins: player.coins,
            isWinner: state.winnerId === player.id,
            piratesEncountered: t?.piratesEncountered ?? 0,
            biggestBank: t?.biggestBank ?? 0,
            maxStreak: t?.maxStreakLength ?? 0,
         };
      }),
   );
}

export type VoyageView = {
   id: string;
   deckVariant: string;
   completedAt: Date;
   playerCount: number;
   winnerName: string | null;
   /** The requesting player's own row, for the summary line. */
   you: DbVoyagePlayer | null;
   /** Full standings, ordered by placement. */
   players: DbVoyagePlayer[];
};

/**
 * A player's voyage logbook, newest first, with each voyage's full standings.
 * `limit` bounds the result (3 for the profile preview, larger for "see all").
 */
export async function fetchVoyagesForUser(userId: string, limit: number): Promise<VoyageView[]> {
   const mine = await db
      .select({
         id: voyages.id,
         deckVariant: voyages.deckVariant,
         completedAt: voyages.completedAt,
         playerCount: voyages.playerCount,
         winnerName: voyages.winnerName,
      })
      .from(voyages)
      .innerJoin(voyagePlayers, eq(voyagePlayers.voyageId, voyages.id))
      .where(eq(voyagePlayers.userId, userId))
      .orderBy(desc(voyages.completedAt))
      .limit(limit);

   if (mine.length === 0) return [];

   const ids = mine.map((v) => v.id);
   const allPlayers = await db
      .select()
      .from(voyagePlayers)
      .where(inArray(voyagePlayers.voyageId, ids));

   const byVoyage = new Map<string, DbVoyagePlayer[]>();
   for (const p of allPlayers) {
      const list = byVoyage.get(p.voyageId) ?? [];
      list.push(p);
      byVoyage.set(p.voyageId, list);
   }

   return mine.map((v) => {
      const players = (byVoyage.get(v.id) ?? []).sort((a, b) => a.placement - b.placement);
      return {
         ...v,
         players,
         you: players.find((p) => p.userId === userId) ?? null,
      };
   });
}
