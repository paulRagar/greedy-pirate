-- Tighten RLS on public.games so the deck order (in games.state.deck) is
-- never readable by anon or authenticated clients. The existing
-- `games_member_read` policy let any seated player select the row, which
-- included the JSONB `state` column with the full remaining deck.
--
-- All server code reads `games` through Drizzle (DATABASE_URL service-role),
-- which bypasses RLS. Clients now interact with games only via:
--   - Server-rendered pages (RSC) that hand them a sanitized PublicGameState.
--   - Realtime postgres_changes on `game_events` (sanitized payload).
--
-- If we ever need direct client SELECT on games, split the secret deck
-- into a separate `games_private` table with service-role-only access.

drop policy if exists games_member_read on public.games;
