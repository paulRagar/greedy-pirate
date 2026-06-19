-- Greedy Pirate — RLS for user_achievements (GRE-26)
-- The Drizzle migration creates the table; this gates direct client reads.
-- The server writes achievements via the direct Postgres connection (service
-- role at the connection level), which bypasses RLS — so only a self-read
-- policy is needed for defense-in-depth if the table is ever queried as a user.

alter table public.user_achievements enable row level security;

create policy user_achievements_self_read on public.user_achievements
  for select using (auth.uid() = user_id);
