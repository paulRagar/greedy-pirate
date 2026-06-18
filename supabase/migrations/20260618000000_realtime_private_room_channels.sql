-- GRE-6 — Private realtime channels + RLS on realtime.messages
--
-- Until now every broadcast was published with `private: false` and clients
-- subscribed to `room:{CODE}` with the anon key and NO authorization. Supabase
-- Realtime only enforces auth (RLS on realtime.messages) for *private* channels.
-- With public channels, any client could enumerate 4-char codes, subscribe to a
-- foreign room, harvest player displayNames + live state, and even publish a
-- forged `state` event onto every real player.
--
-- This migration locks room channels down to members. Two topic shapes are
-- authorized:
--   * room:{CODE}     -> host, a seated (not-left) player, or a spectator of the
--                        game with that code (lobby/active only).
--   * knock:{USER_ID} -> the user whose id matches the topic suffix. Used to tell
--                        a pending join-requester (not yet a member) the captain's
--                        verdict without exposing room state to them.
--
-- The lobby channel (`lobby:public`) stays a public channel — RLS is not
-- consulted for it. The server publishes everything via the service role, which
-- bypasses RLS, so these policies only gate what clients may read/send.

-- Membership check for a room:{CODE} topic. SECURITY DEFINER because the
-- `authenticated` role has no SELECT grant on games/game_players/game_spectators
-- (client reads were locked down in earlier migrations); the function owner does.
create or replace function realtime.is_room_member(topic_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
   select exists (
      select 1
      from games g
      where topic_name like 'room:%'
        and g.code is not null
        and upper(g.code) = upper(split_part(topic_name, ':', 2))
        and g.status in ('lobby', 'active')
        and (
           g.host_id = (select auth.uid())
           or exists (
              select 1 from game_players gp
              where gp.game_id = g.id
                and gp.user_id = (select auth.uid())
                and gp.left_at is null
           )
           or exists (
              select 1 from game_spectators gs
              where gs.game_id = g.id
                and gs.user_id = (select auth.uid())
           )
        )
   );
$$;

-- A knock:{USER_ID} topic belongs to exactly one user. No table lookup needed.
create or replace function realtime.is_own_knock_topic(topic_name text)
returns boolean
language sql
stable
as $$
   select topic_name = 'knock:' || (select auth.uid())::text;
$$;

-- realtime.messages already has RLS enabled by Supabase with no policies, so
-- private channels are deny-by-default today. Add permissive policies (OR'd):
-- broadcast reads are SELECT, broadcast sends + presence tracking are INSERT.
create policy "room members access their room topic"
on realtime.messages
for all
to authenticated
using (realtime.is_room_member(realtime.topic()))
with check (realtime.is_room_member(realtime.topic()));

create policy "users access their own knock topic"
on realtime.messages
for all
to authenticated
using (realtime.is_own_knock_topic(realtime.topic()))
with check (realtime.is_own_knock_topic(realtime.topic()));
