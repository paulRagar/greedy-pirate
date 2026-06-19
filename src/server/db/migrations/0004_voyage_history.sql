CREATE TABLE "voyage_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voyage_id" uuid NOT NULL,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"placement" integer NOT NULL,
	"coins" integer NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"pirates_encountered" integer DEFAULT 0 NOT NULL,
	"biggest_bank" integer DEFAULT 0 NOT NULL,
	"max_streak" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voyages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"deck_variant" text NOT NULL,
	"player_count" integer NOT NULL,
	"winner_user_id" uuid,
	"winner_name" text,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voyage_players" ADD CONSTRAINT "voyage_players_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_players" ADD CONSTRAINT "voyage_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voyage_players_voyage_idx" ON "voyage_players" USING btree ("voyage_id");--> statement-breakpoint
CREATE INDEX "voyage_players_user_idx" ON "voyage_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "voyages_completed_idx" ON "voyages" USING btree ("completed_at");