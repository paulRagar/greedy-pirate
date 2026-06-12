import { sql } from 'drizzle-orm';
import {
   bigint,
   bigserial,
   boolean,
   index,
   integer,
   jsonb,
   pgSchema,
   pgTable,
   text,
   timestamp,
   unique,
   uniqueIndex,
   uuid,
} from 'drizzle-orm/pg-core';

const auth = pgSchema('auth');
export const authUsers = auth.table('users', {
   id: uuid('id').primaryKey(),
});

export const users = pgTable('users', {
   id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
   displayName: text('display_name').notNull(),
   isAnonymous: boolean('is_anonymous').notNull().default(true),
   createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const games = pgTable(
   'games',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      code: text('code'),
      hostId: uuid('host_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
      mode: text('mode', { enum: ['local', 'online'] }).notNull(),
      deckVariant: text('deck_variant', {
         enum: ['greedy', 'even_greedier', 'super_greedy'],
      }).notNull(),
      status: text('status', { enum: ['lobby', 'active', 'complete', 'abandoned'] }).notNull(),
      state: jsonb('state').notNull().default(sql`'{}'::jsonb`),
      currentPlayerId: uuid('current_player_id'),
      startedAt: timestamp('started_at', { withTimezone: true }),
      completedAt: timestamp('completed_at', { withTimezone: true }),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (t) => ({
      activeCodeIdx: uniqueIndex('games_code_active_idx')
         .on(t.code)
         .where(sql`status in ('lobby', 'active') and code is not null`),
      hostIdx: index('games_host_idx').on(t.hostId),
   }),
);

export const gamePlayers = pgTable(
   'game_players',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      gameId: uuid('game_id')
         .notNull()
         .references(() => games.id, { onDelete: 'cascade' }),
      userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
      seat: integer('seat').notNull(),
      displayName: text('display_name').notNull(),
      coins: integer('coins').notNull().default(0),
      piratesEncountered: integer('pirates_encountered').notNull().default(0),
      isWinner: boolean('is_winner').notNull().default(false),
      joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
      leftAt: timestamp('left_at', { withTimezone: true }),
   },
   (t) => ({
      uniqueGameSeat: unique('game_players_game_seat_unique').on(t.gameId, t.seat),
      gameIdx: index('game_players_game_idx').on(t.gameId),
      userIdx: index('game_players_user_idx').on(t.userId),
   }),
);

export const gameEvents = pgTable(
   'game_events',
   {
      id: bigserial('id', { mode: 'number' }).primaryKey(),
      gameId: uuid('game_id')
         .notNull()
         .references(() => games.id, { onDelete: 'cascade' }),
      seq: integer('seq').notNull(),
      actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
      type: text('type').notNull(),
      payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (t) => ({
      uniqueGameSeq: unique('game_events_game_seq_unique').on(t.gameId, t.seq),
      gameIdx: index('game_events_game_idx').on(t.gameId),
   }),
);

export const userStats = pgTable('user_stats', {
   userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
   gamesPlayed: integer('games_played').notNull().default(0),
   gamesWon: integer('games_won').notNull().default(0),
   totalCoinsCollected: bigint('total_coins_collected', { mode: 'number' }).notNull().default(0),
   totalPiratesEncountered: integer('total_pirates_encountered').notNull().default(0),
   longestStreakValue: integer('longest_streak_value').notNull().default(0),
   updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DbUser = typeof users.$inferSelect;
export type DbUserInsert = typeof users.$inferInsert;
export type DbGame = typeof games.$inferSelect;
export type DbGameInsert = typeof games.$inferInsert;
export type DbGamePlayer = typeof gamePlayers.$inferSelect;
export type DbGamePlayerInsert = typeof gamePlayers.$inferInsert;
export type DbGameEvent = typeof gameEvents.$inferSelect;
export type DbGameEventInsert = typeof gameEvents.$inferInsert;
export type DbUserStats = typeof userStats.$inferSelect;
