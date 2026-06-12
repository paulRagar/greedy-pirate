CREATE TABLE "game_spectators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_spectators_game_user_unique" UNIQUE("game_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "game_spectators" ADD CONSTRAINT "game_spectators_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_spectators" ADD CONSTRAINT "game_spectators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_spectators_game_idx" ON "game_spectators" USING btree ("game_id");