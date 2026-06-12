-- Add game_events to the supabase_realtime publication so clients can subscribe
-- to postgres-changes on this table. Each INSERT carries the public state diff
-- in the `payload` jsonb column.

alter publication supabase_realtime add table public.game_events;

-- Belt-and-braces: also expose game_players so the lobby can react to joins
-- before the first GAME event fires.
alter publication supabase_realtime add table public.game_players;
