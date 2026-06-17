-- Hard-delete old terminal games to keep the table bounded.
--
-- Safe to delete the rows themselves because user_stats is a separate
-- aggregate table — bumpUserStats() runs on the lobby/active → complete
-- transition and persists lifetime totals independently of the games row.
-- Abandoned/lobby rows never contributed to stats in the first place.
--
-- Cascades clear game_players, game_events, game_spectators, and
-- game_join_requests via the FK ON DELETE CASCADE constraints.

create or replace function public.purge_old_games()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
   v_deleted int := 0;
begin
   with deleted as (
      delete from public.games
         where (
                  status = 'abandoned'
                  and coalesce(completed_at, created_at) < now() - interval '7 days'
               )
            or (
                  status = 'complete'
                  and completed_at < now() - interval '30 days'
               )
         returning 1
   )
   select count(*)::int into v_deleted from deleted;
   return v_deleted;
end;
$$;

grant execute on function public.purge_old_games() to service_role;
