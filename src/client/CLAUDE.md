# `src/client/` — Client-only code

Code in this directory runs **only in the browser**. Stores, hooks, and realtime subscribers belong here.

Anything that needs `window`, `localStorage`, React client hooks, or Supabase Realtime browser SDK lives here.

## Sub-directories

- `stores/` — Zustand stores. One store per feature.
- `hooks/` — Custom React hooks (Phase 2+).
- `realtime/` — Supabase Realtime subscribers (Phase 3+).

## Rules

- Every file here is implicitly client-only. The components consuming these utilities must be marked `'use client'`.
- Never import this directory from `src/server/` or `src/game/`. The engine is pure; the server lives on Vercel.
- Stores wrap engine calls — they never duplicate game logic. If a store reaches for `Math.random()` or recomputes rules, that logic belongs in `src/game/`.
