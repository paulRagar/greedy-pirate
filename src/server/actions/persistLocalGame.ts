'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { gameEvents, gamePlayers, games, users } from '@/server/db/schema';
import { getSupabaseServer } from '@/server/supabase/server';
import { DECK_VARIANTS } from '@/game/rules';
import { bumpUserStats } from '@/server/stats';

const PlayerSchema = z.object({
   id: z.string().min(1),
   name: z.string().trim().min(1).max(80),
   coins: z.number().int().min(0),
});

const InputSchema = z.object({
   deckVariant: z.enum(DECK_VARIANTS),
   players: z.array(PlayerSchema).min(2).max(10),
   winnerSeatId: z.string().min(1),
   pirateCount: z.number().int().min(0),
});

export type PersistLocalGameInput = z.input<typeof InputSchema>;
export type PersistLocalGameResult =
   | { ok: true; gameId: string }
   | { ok: false; error: string };

export async function persistLocalGame(input: PersistLocalGameInput): Promise<PersistLocalGameResult> {
   const parsed = InputSchema.safeParse(input);
   if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
   }

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false, error: 'Not signed in' };

   const data = parsed.data;
   const now = new Date();

   try {
      const gameId = await db.transaction(async (tx) => {
         const inserted = await tx
            .insert(games)
            .values({
               hostId: user.id,
               mode: 'local',
               deckVariant: data.deckVariant,
               status: 'complete',
               startedAt: now,
               completedAt: now,
            })
            .returning({ id: games.id });

         const game = inserted[0];
         if (!game) throw new Error('Failed to insert game');

         await tx.insert(gamePlayers).values(
            data.players.map((player, seat) => ({
               gameId: game.id,
               userId: null,
               seat,
               displayName: player.name,
               coins: player.coins,
               isWinner: player.id === data.winnerSeatId,
            })),
         );

         await tx.insert(gameEvents).values({
            gameId: game.id,
            seq: 0,
            actorId: user.id,
            type: 'GAME_ENDED',
            payload: { pirateCount: data.pirateCount, winnerSeatId: data.winnerSeatId },
         });

         // Local games credit stats to the host based on a name match against
         // the seats. Multi-device local play means non-host players never
         // had accounts — they aren't counted here.
         const profile = await tx.query.users.findFirst({ where: eq(users.id, user.id) });
         if (profile) {
            const hostSeat = data.players.find((p) => p.name === profile.displayName);
            if (hostSeat) {
               await bumpUserStats(tx, [
                  {
                     userId: user.id,
                     coins: hostSeat.coins,
                     isWinner: hostSeat.id === data.winnerSeatId,
                  },
               ]);
            }
         }

         return game.id;
      });

      return { ok: true, gameId };
   } catch (err) {
      console.error('persistLocalGame failed', err);
      return { ok: false, error: 'Failed to save game' };
   }
}
