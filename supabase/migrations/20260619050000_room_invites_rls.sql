-- Room invites (GRE-45). The Drizzle migration (0006) creates room_invites.
-- Clients never read or write it directly — inviteFriendToRoom / acceptRoomInvite
-- run on the service-role connection, and the recipient learns of an invite via
-- the user:{id} realtime broadcast, not a DB read. Enable RLS with NO policies
-- so any direct client access is denied by default (defense in depth, matching
-- the games table).
alter table public.room_invites enable row level security;
