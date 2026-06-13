-- Cron safety net for the post-game continuation window. The migration
-- only adds a discovery helper — the actual finalize logic lives in the
-- TS server action so we don't have to replicate engine state shuffling
-- and event-log bookkeeping inside Postgres.

create or replace function public.find_expired_continuations()
returns table (game_code text)
language sql
security definer
set search_path = public
as $$
   select g.code
     from public.games g
    where g.status = 'complete'
      and g.continuation_deadline is not null
      and g.continuation_deadline < now() - interval '2 seconds'
      and g.continuation_finalized = false
      and g.code is not null;
$$;

grant execute on function public.find_expired_continuations() to service_role;
