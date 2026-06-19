CREATE TABLE "friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_low" uuid NOT NULL,
	"user_high" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_pair_unique" UNIQUE("user_low","user_high"),
	CONSTRAINT "friendships_canonical_order" CHECK (user_low < user_high)
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_pair_unique" UNIQUE("blocker_id","blocked_id"),
	CONSTRAINT "user_blocks_no_self" CHECK (blocker_id <> blocked_id)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "friend_code" text;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_low_users_id_fk" FOREIGN KEY ("user_low") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_high_users_id_fk" FOREIGN KEY ("user_high") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friend_requests_one_pending_idx" ON "friend_requests" USING btree ("from_user_id","to_user_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "friend_requests_to_status_idx" ON "friend_requests" USING btree ("to_user_id","status");--> statement-breakpoint
CREATE INDEX "friend_requests_from_status_idx" ON "friend_requests" USING btree ("from_user_id","status");--> statement-breakpoint
CREATE INDEX "friendships_user_low_idx" ON "friendships" USING btree ("user_low");--> statement-breakpoint
CREATE INDEX "friendships_user_high_idx" ON "friendships" USING btree ("user_high");--> statement-breakpoint
CREATE INDEX "user_blocks_blocker_idx" ON "user_blocks" USING btree ("blocker_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_friend_code_unique" UNIQUE("friend_code");