-- Drop the lobby-abandon threshold from 2h → 30min. Tab close beacons
-- handle most leave cases instantly; the cron is the safety net for crashed
-- browsers, killed processes, lost network. Active games still get 6h.

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
           and created_at < now() - interval '30 minutes'
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
