-- Cleanup helpers invoked by /api/cron/cleanup (Vercel Cron in prod, or
-- manually during dev). Keeps stale rooms and old events from accumulating.

-- Abandon stale rooms:
--   * lobbies older than 2 hours that nobody started
--   * active games with no game_event activity in 6 hours
create or replace function public.abandon_stale_games()
returns table(abandoned_lobbies int, abandoned_active int)
language plpgsql
security definer
set search_path = public
as $$
declare
   v_lobbies int := 0;
   v_active int := 0;
begin
   with updated_lobbies as (
      update public.games
         set status = 'abandoned'
         where status = 'lobby'
           and created_at < now() - interval '2 hours'
         returning 1
   )
   select count(*)::int into v_lobbies from updated_lobbies;

   with updated_active as (
      update public.games g
         set status = 'abandoned',
             completed_at = now()
         where g.status = 'active'
           and coalesce(
                  (select max(created_at) from public.game_events e where e.game_id = g.id),
                  g.started_at,
                  g.created_at
               ) < now() - interval '6 hours'
         returning 1
   )
   select count(*)::int into v_active from updated_active;

   return query select v_lobbies, v_active;
end;
$$;

-- Delete game_events older than 30 days. Recent replays still possible.
create or replace function public.prune_old_events()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
   v_deleted int := 0;
begin
   with deleted as (
      delete from public.game_events
         where created_at < now() - interval '30 days'
         returning 1
   )
   select count(*)::int into v_deleted from deleted;
   return v_deleted;
end;
$$;

-- Allow the service role to call these. (Service role bypasses RLS anyway,
-- but be explicit.)
grant execute on function public.abandon_stale_games() to service_role;
grant execute on function public.prune_old_events() to service_role;
