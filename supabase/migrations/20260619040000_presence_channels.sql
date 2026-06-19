-- Friend presence channels (GRE-43)
--
-- Each signed-in user broadcasts their presence (online + current room code) on
-- their OWN private topic `presence:{USER_ID}`. A friend reads it by subscribing
-- to that topic. Privacy: only friends (or the user themselves) may read a
-- presence topic, and a user may only WRITE their own — so nobody can forge
-- presence onto someone else's channel or snoop a stranger's room code.
--
-- This mirrors the per-user knock/user topics (GRE-6 / GRE-35). Channels are
-- multiplexed over a single websocket, so N friend subscriptions cost ~1
-- connection.

-- Read guard: the topic is the viewer's own, OR the suffix user is a friend.
-- SECURITY DEFINER so the function can read public.friendships regardless of the
-- authenticated role's grants (same pattern as realtime.is_room_member).
create or replace function realtime.is_friend_or_self_presence(topic_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
   uid text;
   me uuid := (select auth.uid());
begin
   uid := substring(topic_name from '^presence:(.+)$');
   if uid is null then
      return false;
   end if;
   if uid = me::text then
      return true;
   end if;
   return exists (
      select 1 from public.friendships f
      where (f.user_low = me and f.user_high::text = uid)
         or (f.user_high = me and f.user_low::text = uid)
   );
end;
$$;

-- Write guard: a user may only publish/track on their OWN presence topic.
create or replace function realtime.is_own_presence_topic(topic_name text)
returns boolean
language sql
stable
as $$
   select topic_name = 'presence:' || (select auth.uid())::text;
$$;

-- READ (broadcast/presence receive) = friend-or-self; WRITE (track own state) =
-- self only. Split clauses so a user can SEE friends' presence but only ever
-- SET their own.
create policy "friends read presence topics"
on realtime.messages
for select
to authenticated
using (realtime.is_friend_or_self_presence(realtime.topic()));

create policy "users write only their own presence"
on realtime.messages
for insert
to authenticated
with check (realtime.is_own_presence_topic(realtime.topic()));
