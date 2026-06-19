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
   primaryKey,
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
   email: text('email'),
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
      isPublic: boolean('is_public').notNull().default(false),
      state: jsonb('state').notNull().default(sql`'{}'::jsonb`),
      currentPlayerId: uuid('current_player_id'),
      hostLeftAt: timestamp('host_left_at', { withTimezone: true }),
      continuationDeadline: timestamp('continuation_deadline', { withTimezone: true }),
      continuationFinalized: boolean('continuation_finalized').notNull().default(false),
      startedAt: timestamp('started_at', { withTimezone: true }),
      completedAt: timestamp('completed_at', { withTimezone: true }),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (t) => ({
      activeCodeIdx: uniqueIndex('games_code_active_idx')
         .on(t.code)
         .where(sql`status in ('lobby', 'active') and code is not null`),
      hostIdx: index('games_host_idx').on(t.hostId),
      publicOpenIdx: index('games_public_open_idx')
         .on(t.createdAt)
         .where(sql`is_public and status in ('lobby', 'active')`),
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
      continuedAt: timestamp('continued_at', { withTimezone: true }),
      // One-time token a seated player generates right before they sign
      // in or sign up. The next authenticated request can redeem it to
      // rewrite this seat's userId, letting the player keep their seat
      // across the auth switch instead of being kicked back to a knock.
      transferToken: text('transfer_token'),
      transferExpiresAt: timestamp('transfer_expires_at', { withTimezone: true }),
   },
   (t) => ({
      uniqueGameSeat: unique('game_players_game_seat_unique').on(t.gameId, t.seat),
      gameIdx: index('game_players_game_idx').on(t.gameId),
      userIdx: index('game_players_user_idx').on(t.userId),
      transferTokenIdx: uniqueIndex('game_players_transfer_token_idx')
         .on(t.transferToken)
         .where(sql`transfer_token is not null`),
   }),
);

export const gameSpectators = pgTable(
   'game_spectators',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      gameId: uuid('game_id')
         .notNull()
         .references(() => games.id, { onDelete: 'cascade' }),
      userId: uuid('user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
      displayName: text('display_name').notNull(),
      joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (t) => ({
      uniqueGameUser: unique('game_spectators_game_user_unique').on(t.gameId, t.userId),
      gameIdx: index('game_spectators_game_idx').on(t.gameId),
   }),
);

export const gameJoinRequests = pgTable(
   'game_join_requests',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      gameId: uuid('game_id')
         .notNull()
         .references(() => games.id, { onDelete: 'cascade' }),
      userId: uuid('user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
      displayName: text('display_name').notNull(),
      kind: text('kind', { enum: ['player', 'spectator'] }).notNull(),
      status: text('status', {
         enum: ['pending', 'approved', 'denied', 'cancelled', 'expired'],
      })
         .notNull()
         .default('pending'),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      expiresAt: timestamp('expires_at', { withTimezone: true })
         .notNull()
         .default(sql`now() + interval '30 seconds'`),
      resolvedAt: timestamp('resolved_at', { withTimezone: true }),
   },
   (t) => ({
      onePendingPerUser: uniqueIndex('game_join_requests_one_open_idx')
         .on(t.gameId, t.userId)
         .where(sql`status = 'pending'`),
      gameStatusIdx: index('game_join_requests_game_status_idx').on(t.gameId, t.status),
      expiresIdx: index('game_join_requests_expires_idx')
         .on(t.expiresAt)
         .where(sql`status = 'pending'`),
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
   biggestSingleBank: integer('biggest_single_bank').notNull().default(0),
   updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Unlocked achievements per user. One row per (user, achievement code); the
 * earliest unlock time is preserved via insert-or-ignore. The catalog of codes
 * lives in `src/lib/achievements.ts` — this table only records what's unlocked.
 */
export const userAchievements = pgTable(
   'user_achievements',
   {
      userId: uuid('user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
      code: text('code').notNull(),
      unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (t) => ({
      pk: primaryKey({ columns: [t.userId, t.code] }),
      userIdx: index('user_achievements_user_idx').on(t.userId),
   }),
);

export type DbUser = typeof users.$inferSelect;
export type DbUserInsert = typeof users.$inferInsert;
export type DbGame = typeof games.$inferSelect;
export type DbGameInsert = typeof games.$inferInsert;
export type DbGamePlayer = typeof gamePlayers.$inferSelect;
export type DbGamePlayerInsert = typeof gamePlayers.$inferInsert;
export type DbGameSpectator = typeof gameSpectators.$inferSelect;
export type DbGameSpectatorInsert = typeof gameSpectators.$inferInsert;
export type DbGameJoinRequest = typeof gameJoinRequests.$inferSelect;
export type DbGameJoinRequestInsert = typeof gameJoinRequests.$inferInsert;
export type DbGameEvent = typeof gameEvents.$inferSelect;
export type DbGameEventInsert = typeof gameEvents.$inferInsert;
export type DbUserStats = typeof userStats.$inferSelect;
export type DbUserAchievement = typeof userAchievements.$inferSelect;
export type DbUserAchievementInsert = typeof userAchievements.$inferInsert;
