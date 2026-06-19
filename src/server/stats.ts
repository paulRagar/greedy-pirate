import 'server-only';
import { sql } from 'drizzle-orm';
import { unlockedAchievementCodes } from '@/lib/achievements';
import { userAchievements, userStats } from './db/schema';

type Tx = Parameters<Parameters<(typeof import('./db/client'))['db']['transaction']>[0]>[0];

type ContributionRow = {
   userId: string;
   coins: number;
   isWinner: boolean;
   /** Longest gold streak this player reached this game (cards). */
   maxStreakLength: number;
   /** Largest single banked streak this player made this game (doubloons). */
   biggestBank: number;
   /** Pirates this player drew on their own turns this game. */
   piratesEncountered: number;
};

/**
 * Upsert each player's contribution into user_stats, then unlock any newly
 * earned achievements. Cumulative counters (games, coins, pirates) are
 * incremented; personal bests (longest streak, biggest bank) take the GREATEST
 * of the existing value and this game's. Achievement rows are insert-or-ignore,
 * so the earliest unlock time is preserved across replays.
 */
export async function bumpUserStats(tx: Tx, rows: ContributionRow[]): Promise<void> {
   for (const row of rows) {
      const [updated] = await tx
         .insert(userStats)
         .values({
            userId: row.userId,
            gamesPlayed: 1,
            gamesWon: row.isWinner ? 1 : 0,
            totalCoinsCollected: row.coins,
            totalPiratesEncountered: row.piratesEncountered,
            longestStreakValue: row.maxStreakLength,
            biggestSingleBank: row.biggestBank,
         })
         .onConflictDoUpdate({
            target: userStats.userId,
            set: {
               gamesPlayed: sql`${userStats.gamesPlayed} + 1`,
               gamesWon: row.isWinner
                  ? sql`${userStats.gamesWon} + 1`
                  : sql`${userStats.gamesWon}`,
               totalCoinsCollected: sql`${userStats.totalCoinsCollected} + ${row.coins}`,
               totalPiratesEncountered: sql`${userStats.totalPiratesEncountered} + ${row.piratesEncountered}`,
               longestStreakValue: sql`greatest(${userStats.longestStreakValue}, ${row.maxStreakLength})`,
               biggestSingleBank: sql`greatest(${userStats.biggestSingleBank}, ${row.biggestBank})`,
               updatedAt: sql`now()`,
            },
         })
         .returning();

      if (!updated) continue;

      const codes = unlockedAchievementCodes({
         gamesPlayed: updated.gamesPlayed,
         gamesWon: updated.gamesWon,
         totalCoinsCollected: Number(updated.totalCoinsCollected),
         totalPiratesEncountered: updated.totalPiratesEncountered,
         longestStreakValue: updated.longestStreakValue,
         biggestSingleBank: updated.biggestSingleBank,
      });
      if (codes.length === 0) continue;

      await tx
         .insert(userAchievements)
         .values(codes.map((code) => ({ userId: row.userId, code })))
         .onConflictDoNothing();
   }
}
