-- Friends & Social foundation (GRE-35)
--
-- The Drizzle migration (0005) creates friendships / friend_requests /
-- user_blocks and adds the nullable users.friend_code column + unique index.
-- This migration (run after, via `supabase db push`) does the parts Drizzle
-- can't express:
--   1. A friend-code generator + one-time backfill, then NOT NULL.
--   2. handle_new_user() now stamps a friend_code on every new account.
--   3. RLS (self-scoped, defense-in-depth — server actions use the service role).
--   4. A private realtime topic `user:{USER_ID}` for friend/invite/join notices,
--      mirroring the knock topic from GRE-6.

-- =========================================================================
-- 1. Friend code: short, unambiguous, unique. Alphabet excludes 0/O/1/I/L.
-- =========================================================================

create or replace function public.gen_friend_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
   alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
   code text;
   i int;
begin
   loop
      code := '';
      for i in 1..8 loop
         code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      exit when not exists (select 1 from public.users where friend_code = code);
   end loop;
   return code;
end;
$$;

-- One-time backfill for existing users, then lock the column to NOT NULL.
update public.users set friend_code = public.gen_friend_code() where friend_code is null;
alter table public.users alter column friend_code set not null;

-- =========================================================================
-- 2. Stamp a friend_code on every new account. (Keeps the email + display
-- name behaviour from 20260617000000; adds friend_code.)
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name, email, is_anonymous, friend_code)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      'Crewmate #' || lpad((floor(random() * 10000))::int::text, 4, '0')
    ),
    new.email,
    coalesce(new.is_anonymous, true),
    public.gen_friend_code()
  )
  on conflict (id) do nothing;

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- =========================================================================
-- 3. Row level security (self-scoped). All writes go through server actions
-- on the service-role connection, which bypasses RLS; these policies are
-- defense-in-depth if a table is ever read with a user JWT.
-- =========================================================================

alter table public.friendships enable row level security;
alter table public.friend_requests enable row level security;
alter table public.user_blocks enable row level security;

-- friendships: either member of the pair can read the edge.
create policy friendships_member_read on public.friendships
  for select using (auth.uid() in (user_low, user_high));

-- friend_requests: sender or recipient can read.
create policy friend_requests_party_read on public.friend_requests
  for select using (auth.uid() in (from_user_id, to_user_id));

-- user_blocks: only the blocker can read their block list. The blocked user is
-- deliberately not told they were blocked.
create policy user_blocks_blocker_read on public.user_blocks
  for select using (auth.uid() = blocker_id);

-- =========================================================================
-- 4. Private per-user realtime topic `user:{USER_ID}`. Generalises the knock
-- topic (GRE-6) so we can push friend requests, room invites, and join
-- notices to a user who is not currently in any room.
-- =========================================================================

create or replace function realtime.is_own_user_topic(topic_name text)
returns boolean
language sql
stable
as $$
   select topic_name = 'user:' || (select auth.uid())::text;
$$;

create policy "users access their own user topic"
on realtime.messages
for all
to authenticated
using (realtime.is_own_user_topic(realtime.topic()))
with check (realtime.is_own_user_topic(realtime.topic()));
