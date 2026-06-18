# Development workflow

How work flows from a Linear ticket to merged code. **Follow this for every change.**

## Linear

- **Team:** Greedy Pirate (`linear.app/greedy-pirate`). New issues land in **Backlog**.
- **Severity** = native Priority field: Urgent / High / Medium (no severity labels).
- **Area** = one mutually-exclusive label per issue: `Security` · `Architecture` · `UI/UX` · `Accessibility` · `Gamification`.
- **Type** = `Bug` / `Feature` / `Improvement`.
- Linear is connected to the GitHub `greedy-pirate` repo — **status is driven by Git**, not set by hand:
  - linked branch gets a commit → **In Progress**
  - PR opened with the Linear branch name → **In Review**
  - PR merged to `main` → **Done**

## Status: start of work

When starting a ticket, make sure it shows **In Progress**. The GitHub link moves it there on first commit to the Linear-named branch; if it hasn't moved, set it manually.

## Branching

- Branch off **`main`**, one branch per ticket, PR back to `main` (no develop/staging branch).
- **Use the branch name Linear suggests** for the ticket (e.g. `paulragar/gre-5-lock-the-game-row-during-apply...`). This is what links the PR to the ticket and drives auto-status. Get it from the ticket page (copy git branch name) or the `gitBranchName` field returned by the Linear MCP.
- One ticket = one PR. Large tickets (e.g. GRE-5, GRE-26): break into sub-tasks first.

## Pull requests

- Use `.github/pull_request_template.md` (every PR). Required sections:
  - **Summary** + `Closes GRE-XXX`
  - **Per-change breakdown** — one bullet per meaningful change (not a high-level summary)
  - **Manual testing** — step-by-step for Paul: what to do AND what he should expect to see, including any setup (two browser sessions, local Supabase, etc.). Mobile check at 360–414px when UI changes.
  - Automated-checks checklist, risk/rollback, reviewer notes.
- **Never auto-merge.** Claude opens the PR and stops. **Paul always reviews, approves, and merges.**

## Testing policy

Decide **per issue** whether to add Vitest and/or e2e tests — this is a judgment call every PR, not automatic.

- **Add a test when it earns its keep:** pure logic / engine rules, state-machine edges, concurrency, reconciliation, security/authorization, regressions, anything easy to break silently.
- **Skip it when it doesn't:** cosmetic/copy/styling, throwaway code, things a test would only restate, or where an e2e would be slow + flaky for little signal.
- **Guard the suite.** No bloat, no redundant tests, keep it fast. Prefer a focused unit test over a heavy e2e when either would do. If you skip tests for a change, say so in the PR (one line of why).

## Before opening a PR

**All tests must pass first** — only create the PR on green. Run and pass: `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run test:e2e` where the change warrants it.

## Commit / PR trailers

- Commits end with the Co-Authored-By trailer for the active model.
- PR bodies end with the Claude Code generation note.

---

## Linear ticket template

Use this shape when filing issues (Medium severity and above; group trivial nits into one issue).

```markdown
## Problem
<what's wrong / the opportunity, and why it matters>

## Evidence
- `file_path:line` — concrete reference / excerpt

## Impact            <!-- or "Exploit" for security -->
<who/what is affected>

## Proposed design    <!-- for features/improvements; omit for plain bugs -->
<approach, options if more than one>

## Acceptance Criteria
- [ ] bullet describing "done"
- [ ] ...

## Test Plan
- unit / e2e / manual steps to verify the fix
```

Set Priority (Urgent/High/Medium), one Area label, and a Type label on every issue.
