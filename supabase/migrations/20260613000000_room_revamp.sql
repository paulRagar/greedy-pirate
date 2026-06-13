-- Room revamp: public/private visibility, knock-to-board join requests,
-- host migration support, and a sanitized public-lobby listing RPC.
--
-- All writes still flow through server actions (service role). New
-- game_join_requests table mirrors that pattern: RLS enabled, no client
-- policies — broadcasts deliver state to clients.

-- =========================================================================
-- 1. Column additions on public.games
-- =========================================================================

alter table public.games
   add column if not exists is_public boolean not null default false;

alter table public.games
   add column if not exists host_left_at timestamptz;

-- Drive the Find Crew lobby list. Partial index keeps it cheap.
create index if not exists games_public_open_idx
   on public.games (created_at desc)
   where is_public and status in ('lobby', 'active');

-- =========================================================================
-- 2. game_join_requests
-- =========================================================================

create table if not exists public.game_join_requests (
   id            uuid primary key default gen_random_uuid(),
   game_id       uuid not null references public.games(id) on delete cascade,
   user_id       uuid not null references public.users(id) on delete cascade,
   display_name  text not null,
   kind          text not null check (kind in ('player', 'spectator')),
   status        text not null default 'pending'
                 check (status in ('pending', 'approved', 'denied', 'cancelled', 'expired')),
   created_at    timestamptz not null default now(),
   expires_at    timestamptz not null default (now() + interval '30 seconds'),
   resolved_at   timestamptz
);

-- One open knock per (game, user). Older resolved rows stay for audit.
create unique index if not exists game_join_requests_one_open_idx
   on public.game_join_requests (game_id, user_id)
   where status = 'pending';

create index if not exists game_join_requests_game_status_idx
   on public.game_join_requests (game_id, status);

create index if not exists game_join_requests_expires_idx
   on public.game_join_requests (expires_at)
   where status = 'pending';

alter table public.game_join_requests enable row level security;
-- No client policies — only the service role (Drizzle / server actions) writes/reads.

-- =========================================================================
-- 3. RPC: list_public_rooms — sanitized lobby feed for /play/lobby
-- =========================================================================

create or replace function public.list_public_rooms()
returns table (
   id                  uuid,
   code                text,
   host_display_name   text,
   player_count        integer,
   max_players         integer,
   status              text,
   deck_variant        text,
   created_at          timestamptz
)
language sql
security definer
set search_path = public
as $$
   select
      g.id,
      g.code,
      coalesce(u.display_name, 'Captain') as host_display_name,
      coalesce(seated.cnt, 0)::int as player_count,
      10::int as max_players,
      g.status,
      g.deck_variant,
      g.created_at
   from public.games g
   left join public.users u on u.id = g.host_id
   left join lateral (
      select count(*)::int as cnt
        from public.game_players gp
       where gp.game_id = g.id
         and gp.left_at is null
   ) seated on true
   where g.is_public
     and g.status in ('lobby', 'active')
     and g.code is not null
   order by g.created_at desc
   limit 50;
$$;

grant execute on function public.list_public_rooms() to anon, authenticated, service_role;

-- =========================================================================
-- 4. RPC: expire_pending_join_requests — cron sweep
-- =========================================================================

create or replace function public.expire_pending_join_requests()
returns table (game_code text, request_id uuid, requester_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
   return query
   with expired as (
      update public.game_join_requests jr
         set status = 'expired', resolved_at = now()
         where jr.status = 'pending'
           and jr.expires_at < now()
         returning jr.id, jr.user_id, jr.game_id
   )
   select g.code as game_code, expired.id as request_id, expired.user_id as requester_id
     from expired
     join public.games g on g.id = expired.game_id;
end;
$$;

grant execute on function public.expire_pending_join_requests() to service_role;

-- =========================================================================
-- 5. RPC: migrate_orphan_hosts — promote earliest-joined player when host
--    has left and not nominated a successor.
-- =========================================================================

create or replace function public.migrate_orphan_hosts()
returns table (game_code text, new_host_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
   return query
   with candidates as (
      select g.id as game_id, g.code, g.host_id as old_host_id,
             (select gp.user_id
                from public.game_players gp
               where gp.game_id = g.id
                 and gp.user_id is not null
                 and gp.user_id <> g.host_id
                 and gp.left_at is null
               order by gp.joined_at asc
               limit 1) as next_host
        from public.games g
       where g.host_left_at is not null
         and g.host_left_at < now() - interval '30 seconds'
         and g.status in ('lobby', 'active')
   ),
   updated as (
      update public.games g
         set host_id = c.next_host,
             host_left_at = null
        from candidates c
       where g.id = c.game_id
         and c.next_host is not null
       returning g.code, g.host_id
   )
   select code, host_id from updated;
end;
$$;

grant execute on function public.migrate_orphan_hosts() to service_role;
