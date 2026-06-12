-- game_spectators is server-only just like games. All reads/writes flow
-- through Drizzle (service-role at the connection level). Anon /
-- authenticated clients see nothing direct; the broadcast payload is
-- the only consumer-visible channel.

alter table public.game_spectators enable row level security;
