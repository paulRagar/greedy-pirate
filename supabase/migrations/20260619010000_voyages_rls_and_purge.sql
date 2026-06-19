-- Greedy Pirate — RLS + retention for the voyage log (GRE-34)
-- The Drizzle migration creates `voyages` + `voyage_players`. The server reads
-- them via the direct (service-role) connection, which bypasses RLS — these
-- self-scoped policies are defense-in-depth if ever queried as a user.

alter table public.voyages enable row level security;
alter table public.voyage_players enable row level security;

-- A player can read voyages they took part in (drives the per-voyage detail,
-- which lists every participant).
create policy voyages_participant_read on public.voyages
  for select using (
    exists (
      select 1 from public.voyage_players vp
      where vp.voyage_id = voyages.id and vp.user_id = auth.uid()
    )
  );

-- A player can read the roster of any voyage they participated in.
create policy voyage_players_participant_read on public.voyage_players
  for select using (
    exists (
      select 1 from public.voyage_players mine
      where mine.voyage_id = voyage_players.voyage_id and mine.user_id = auth.uid()
    )
  );

-- Retention: keep voyages for a year, then hard-delete. Rows are tiny, but the
-- log is unbounded otherwise. Cascades clear voyage_players.
create or replace function public.purge_old_voyages()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
   v_deleted int := 0;
begin
   with deleted as (
      delete from public.voyages
         where completed_at < now() - interval '365 days'
         returning 1
   )
   select count(*)::int into v_deleted from deleted;
   return v_deleted;
end;
$$;

grant execute on function public.purge_old_voyages() to service_role;
