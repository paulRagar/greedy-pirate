-- Default display name now includes a 4-digit random suffix so a fresh
-- anonymous user is distinguishable in lobbies before they pick a real
-- name. Existing 'Crewmate' rows are left untouched — the prompt-after-
-- admission flow lets users rename in-app, and a mass backfill on prod
-- data is riskier than letting natural usage drain it.

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
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      'Crewmate #' || lpad((floor(random() * 10000))::int::text, 4, '0')
    ),
    coalesce(new.is_anonymous, true)
  )
  on conflict (id) do nothing;

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
