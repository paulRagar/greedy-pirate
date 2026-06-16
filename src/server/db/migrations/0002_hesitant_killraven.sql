-- Seat-transfer token columns on game_players. A seated player about to
-- sign in or sign up generates a one-time token; the next authenticated
-- request can redeem it to rewrite this seat's user_id, keeping them in
-- the game across the auth switch.
ALTER TABLE "game_players" ADD COLUMN IF NOT EXISTS "transfer_token" text;--> statement-breakpoint
ALTER TABLE "game_players" ADD COLUMN IF NOT EXISTS "transfer_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_players_transfer_token_idx" ON "game_players" USING btree ("transfer_token") WHERE transfer_token is not null;
