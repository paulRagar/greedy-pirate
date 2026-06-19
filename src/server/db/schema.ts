import { sql } from 'drizzle-orm';
import {
   bigint,
   bigserial,
   boolean,
   check,
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
   // Short, shareable, unambiguous code (e.g. "7K2QF8MN") used to add a friend
   // without exposing email (PII). Generated + backfilled in SQL (see the
   // friends-graph migration); enforced NOT NULL there once populated. Nullable
   // in the Drizzle type only because the column is added before the backfill.
   friendCode: text('friend_code').unique(),
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
      // Absolute wall-clock deadline for the current turn's shot clock. Reset
      // server-side on every turn advance + DRAW; null while not active. Clients
      // render the countdown from this and fire the auto-resolve at expiry.
      turnDeadline: timestamp('turn_deadline', { withTimezone: true }),
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
      // Set when a crewmate marks themselves ready in the lobby; cleared when
      // they stand down. Null ⇒ not ready. Drives the ready-up start gate.
      readyAt: timestamp('ready_at', { withTimezone: true }),
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

/**
 * Immutable archive of a finished online game. Written at completion, before
 * the live `games` row is recycled by the continuation/restart flow. This is
 * the source of truth for a player's voyage logbook — independent of `games`.
 */
export const voyages = pgTable(
   'voyages',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      /** Room code at the time of play — reference only, not a live FK. */
      code: text('code').notNull(),
      deckVariant: text('deck_variant').notNull(),
      playerCount: integer('player_count').notNull(),
      /** Winner's user id at completion; null if that account is later deleted. */
      winnerUserId: uuid('winner_user_id').references(() => users.id, { onDelete: 'set null' }),
      winnerName: text('winner_name'),
      completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (t) => ({
      completedIdx: index('voyages_completed_idx').on(t.completedAt),
   }),
);

/** Per-player snapshot of a finished voyage (display names frozen at the time). */
export const voyagePlayers = pgTable(
   'voyage_players',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      voyageId: uuid('voyage_id')
         .notNull()
         .references(() => voyages.id, { onDelete: 'cascade' }),
      userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
      displayName: text('display_name').notNull(),
      /** 1-based finishing rank (by coins desc). */
      placement: integer('placement').notNull(),
      coins: integer('coins').notNull(),
      isWinner: boolean('is_winner').notNull().default(false),
      piratesEncountered: integer('pirates_encountered').notNull().default(0),
      biggestBank: integer('biggest_bank').notNull().default(0),
      maxStreak: integer('max_streak').notNull().default(0),
   },
   (t) => ({
      voyageIdx: index('voyage_players_voyage_idx').on(t.voyageId),
      userIdx: index('voyage_players_user_idx').on(t.userId),
   }),
);

/**
 * Accepted friendship edges. Stored as a single canonical row per pair with
 * `user_low < user_high` (enforced by a CHECK in the friends-graph migration),
 * so a friendship is one row, not two mirrored rows. "List my friends" unions
 * the two columns. The request/approve lifecycle (separate issue) inserts here
 * on accept; blocking removes the row.
 */
export const friendships = pgTable(
   'friendships',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      userLow: uuid('user_low')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
      userHigh: uuid('user_high')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (t) => ({
      uniquePair: unique('friendships_pair_unique').on(t.userLow, t.userHigh),
      canonicalOrder: check('friendships_canonical_order', sql`user_low < user_high`),
      userLowIdx: index('friendships_user_low_idx').on(t.userLow),
      userHighIdx: index('friendships_user_high_idx').on(t.userHigh),
   }),
);

/**
 * Friend requests. Unlike knock requests (`game_join_requests`) these are
 * persistent — no TTL — and drive a durable inbox. A partial unique index keeps
 * at most one `pending` row per ordered (from, to) pair; the reverse-pending
 * auto-accept and block guards live in the lifecycle server actions.
 */
export const friendRequests = pgTable(
   'friend_requests',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      fromUserId: uuid('from_user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
      toUserId: uuid('to_user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
      status: text('status', {
         enum: ['pending', 'accepted', 'declined', 'cancelled'],
      })
         .notNull()
         .default('pending'),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      resolvedAt: timestamp('resolved_at', { withTimezone: true }),
   },
   (t) => ({
      onePendingPerPair: uniqueIndex('friend_requests_one_pending_idx')
         .on(t.fromUserId, t.toUserId)
         .where(sql`status = 'pending'`),
      toStatusIdx: index('friend_requests_to_status_idx').on(t.toUserId, t.status),
      fromStatusIdx: index('friend_requests_from_status_idx').on(t.fromUserId, t.status),
   }),
);

/**
 * Directed blocks. `blocker_id` no longer receives requests/invites/notices
 * from `blocked_id`. Enforcement (reject sends, drop notices, hide from search)
 * lives in the block/lifecycle server actions; this table is just the record.
 */
export const userBlocks = pgTable(
   'user_blocks',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      blockerId: uuid('blocker_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
      blockedId: uuid('blocked_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (t) => ({
      uniquePair: unique('user_blocks_pair_unique').on(t.blockerId, t.blockedId),
      noSelfBlock: check('user_blocks_no_self', sql`blocker_id <> blocked_id`),
      blockerIdx: index('user_blocks_blocker_idx').on(t.blockerId),
   }),
);

/**
 * A friend's invitation to join a specific room. Short-lived; lets the
 * recipient bypass the knock (they were invited by a member). Written by
 * `inviteFriendToRoom`, redeemed by `acceptRoomInvite` (GRE-45).
 */
export const roomInvites = pgTable(
   'room_invites',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      gameId: uuid('game_id')
         .notNull()
         .references(() => games.id, { onDelete: 'cascade' }),
      fromUserId: uuid('from_user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
      toUserId: uuid('to_user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
      status: text('status', {
         enum: ['pending', 'accepted', 'declined', 'cancelled', 'expired'],
      })
         .notNull()
         .default('pending'),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      expiresAt: timestamp('expires_at', { withTimezone: true })
         .notNull()
         .default(sql`now() + interval '2 minutes'`),
      resolvedAt: timestamp('resolved_at', { withTimezone: true }),
   },
   (t) => ({
      onePendingPerPair: uniqueIndex('room_invites_one_pending_idx')
         .on(t.gameId, t.toUserId)
         .where(sql`status = 'pending'`),
      toStatusIdx: index('room_invites_to_status_idx').on(t.toUserId, t.status),
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
export type DbVoyage = typeof voyages.$inferSelect;
export type DbVoyageInsert = typeof voyages.$inferInsert;
export type DbVoyagePlayer = typeof voyagePlayers.$inferSelect;
export type DbVoyagePlayerInsert = typeof voyagePlayers.$inferInsert;
export type DbFriendship = typeof friendships.$inferSelect;
export type DbFriendshipInsert = typeof friendships.$inferInsert;
export type DbFriendRequest = typeof friendRequests.$inferSelect;
export type DbFriendRequestInsert = typeof friendRequests.$inferInsert;
export type DbUserBlock = typeof userBlocks.$inferSelect;
export type DbUserBlockInsert = typeof userBlocks.$inferInsert;
export type DbRoomInvite = typeof roomInvites.$inferSelect;
export type DbRoomInviteInsert = typeof roomInvites.$inferInsert;
