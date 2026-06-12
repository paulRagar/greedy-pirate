import 'server-only';
import { sql } from 'drizzle-orm';
import { userStats } from './db/schema';

type Tx = Parameters<Parameters<(typeof import('./db/client'))['db']['transaction']>[0]>[0];

type ContributionRow = {
   userId: string;
   coins: number;
   isWinner: boolean;
};

/**
 * Upsert a player's contribution into user_stats. Increments games_played by 1,
 * games_won by 1 if they won, and total_coins_collected by their final coins.
 */
export async function bumpUserStats(tx: Tx, rows: ContributionRow[]): Promise<void> {
   for (const row of rows) {
      await tx
         .insert(userStats)
         .values({
            userId: row.userId,
            gamesPlayed: 1,
            gamesWon: row.isWinner ? 1 : 0,
            totalCoinsCollected: row.coins,
         })
         .onConflictDoUpdate({
            target: userStats.userId,
            set: {
               gamesPlayed: sql`${userStats.gamesPlayed} + 1`,
               gamesWon: row.isWinner
                  ? sql`${userStats.gamesWon} + 1`
                  : sql`${userStats.gamesWon}`,
               totalCoinsCollected: sql`${userStats.totalCoinsCollected} + ${row.coins}`,
               updatedAt: sql`now()`,
            },
         });
   }
}
