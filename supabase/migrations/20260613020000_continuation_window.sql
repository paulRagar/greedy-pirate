-- 60-second post-game continuation window. Every seated player must click
-- Continue or jump ship; non-deciders walk the plank automatically.

alter table public.games
   add column if not exists continuation_deadline timestamptz;

alter table public.games
   add column if not exists continuation_finalized boolean not null default false;

alter table public.game_players
   add column if not exists continued_at timestamptz;
