<!--
Greedy Pirate PR template. Fill every section. Delete a section only if truly N/A (say why).
The "Manual testing" section is mandatory — Paul tests by hand before approving.
-->

## Summary
<!-- One or two sentences: what this PR does and why. -->

Closes GRE-XXX <!-- Linear auto-links via the branch name and moves the ticket In Review on open, Done on merge to main. -->

## Per-change breakdown
<!-- One bullet per meaningful change, grouped by area. Not a high-level summary — name the files/behaviors touched. -->
- `path/to/file` — what changed and why
-

## Manual testing
<!-- REQUIRED. Step-by-step for Paul: exactly what to do AND what he should see. -->

**Setup** (only if more than `npm run dev` is needed):
<!-- e.g. "npx supabase start", "open two browser sessions", "sign in as anon", seed data, env vars -->

**Steps & expected results:**
1. Do … → expect to see …
2. Do … → expect to see …

**Mobile check** (if UI changed): tested at 360–414px width — describe what to verify.

## Automated checks
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test:run` passes
- [ ] New/updated tests cover the change (or note why not)
- [ ] e2e (`npm run test:e2e`) where relevant

## Risk & rollback
<!-- Migrations? Data changes? Realtime/RLS impact? How to revert if it goes wrong. -->

## Notes for reviewer
<!-- Anything Paul should pay attention to, open questions, follow-ups. Do NOT merge — Paul approves and merges. -->
