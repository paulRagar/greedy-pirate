-- Greedy Pirate — RLS policies and auth triggers
-- Runs after Drizzle migrations have created the public tables.

-- =========================================================================
-- Auto-provision users + user_stats when a new auth.users row is created.
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name, is_anonymous)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Crewmate'),
    coalesce(new.is_anonymous, true)
  )
  on conflict (id) do nothing;

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- Row level security
-- =========================================================================

alter table public.users enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_events enable row level security;
alter table public.user_stats enable row level security;

-- users: a user reads only their own profile and updates only their own.
create policy users_self_read on public.users
  for select using (auth.uid() = id);

create policy users_self_update on public.users
  for update using (auth.uid() = id);

-- user_stats: self-only read.
create policy user_stats_self_read on public.user_stats
  for select using (auth.uid() = user_id);

-- games: readable by host or any seated player.
create policy games_member_read on public.games
  for select using (
    host_id = auth.uid()
    or exists (
      select 1 from public.game_players gp
      where gp.game_id = games.id and gp.user_id = auth.uid()
    )
  );

-- game_players: readable by anyone in the same game.
create policy game_players_co_member_read on public.game_players
  for select using (
    exists (
      select 1 from public.game_players self
      where self.game_id = game_players.game_id and self.user_id = auth.uid()
    )
    or exists (
      select 1 from public.games g
      where g.id = game_players.game_id and g.host_id = auth.uid()
    )
  );

-- game_events: readable by anyone in the same game.
create policy game_events_co_member_read on public.game_events
  for select using (
    exists (
      select 1 from public.game_players self
      where self.game_id = game_events.game_id and self.user_id = auth.uid()
    )
    or exists (
      select 1 from public.games g
      where g.id = game_events.game_id and g.host_id = auth.uid()
    )
  );

-- All writes go through server actions using the service-role key (which
-- bypasses RLS). The anon role has no write privileges on these tables.
