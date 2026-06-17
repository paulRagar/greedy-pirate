-- Mirror auth.users.email into public.users.email.
--
-- Why: enables joining game data with email-based external systems
-- (HubSpot, Stripe) and surfacing the host email on the admin rooms
-- page without round-tripping the Supabase Admin API on every render.
--
-- PII handling: email is restricted by the existing users_self_read RLS
-- policy on public.users (auth.uid() = id). No SECURITY DEFINER function
-- in this repo exposes the new column. Admin reads use Drizzle (service
-- role) and are gated by ADMIN_EMAILS, so the admin page surface is
-- already restricted.
--
-- Anon users have email = null; the column stays nullable.

alter table public.users
   add column if not exists email text;

-- handle_new_user runs on auth.users INSERT. Capture email on signup.
-- (Anonymous signups have email = null; raw_user_meta_data is still the
-- source of truth for display_name overrides.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name, email, is_anonymous)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      'Crewmate #' || lpad((floor(random() * 10000))::int::text, 4, '0')
    ),
    new.email,
    coalesce(new.is_anonymous, true)
  )
  on conflict (id) do nothing;

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Anon → email upgrade path: AccountLinkModal calls supabase.auth.updateUser
-- with the email, which sets auth.users.email AFTER the public.users row
-- already exists. Without this trigger our mirror would silently drift.
create or replace function public.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
   if new.email is distinct from old.email then
      update public.users
         set email = new.email
       where id = new.id;
   end if;
   return new;
end;
$$;

drop trigger if exists on_auth_user_email_update on auth.users;
create trigger on_auth_user_email_update
   after update of email on auth.users
   for each row
   when (new.email is distinct from old.email)
   execute function public.sync_user_email();

-- One-time backfill for existing rows. auth.users is fully readable by
-- the service role running the migration.
update public.users u
   set email = a.email
  from auth.users a
 where a.id = u.id
   and u.email is distinct from a.email;
