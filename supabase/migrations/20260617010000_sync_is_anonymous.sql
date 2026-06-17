-- Mirror auth.users.is_anonymous changes into public.users.is_anonymous.
--
-- Why: when email confirmation is enabled on the Supabase project (the
-- default in prod/preview), the anon -> email upgrade flow stays
-- is_anonymous = true until the user clicks the confirmation link.
-- Supabase flips auth.users.is_anonymous to false at that point, but
-- public.users never hears about it, so the UI keeps treating the user
-- as a guest (skull avatar, "Sign up / Sign in" in the dropdown).
--
-- handle_new_user covers the initial INSERT; this trigger covers later
-- updates. Together they keep public.users.is_anonymous authoritative.

create or replace function public.sync_user_is_anonymous()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
   if new.is_anonymous is distinct from old.is_anonymous then
      update public.users
         set is_anonymous = new.is_anonymous
       where id = new.id;
   end if;
   return new;
end;
$$;

drop trigger if exists on_auth_user_anon_update on auth.users;
create trigger on_auth_user_anon_update
   after update of is_anonymous on auth.users
   for each row
   when (new.is_anonymous is distinct from old.is_anonymous)
   execute function public.sync_user_is_anonymous();

-- Backfill: any drift from past upgrades that completed without sync.
update public.users u
   set is_anonymous = a.is_anonymous
  from auth.users a
 where a.id = u.id
   and u.is_anonymous is distinct from a.is_anonymous;
