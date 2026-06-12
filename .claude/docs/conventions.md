# Conventions

Small set of rules. Followed everywhere unless there's a documented reason not to.

## File & directory naming

- **Directories:** `kebab-case` (`play-local`, `game-room`).
- **React components:** `PascalCase.tsx` (`PlayLocalClient.tsx`, `Button.tsx`).
- **Non-component modules:** `camelCase.ts` (`gameStore.ts`, `useDeck.ts`).
- **Test files:** colocated as `xxx.test.ts`.
- **One default export per component file.** Named exports for utilities.

## Imports

- Use TS path aliases: `@/game/*`, `@/server/*`, `@/client/*`, `@/ui/*`, `@/lib/*`.
- Order: external → `@/` aliases → relative. ESLint enforces.
- Prefer named imports unless the library exports a default.

## React patterns

- **Server Components by default.** Only add `'use client'` when the file needs state, effects, browser APIs, or event handlers.
- **Composition over options.** Prefer `<Modal><Modal.Header /></Modal>` over `<Modal headerText="...">` once a component has 3+ props that configure layout.
- **Don't nest state setters.** `setX(prev => { setY(...); return next; })` is a code smell — the side effect should be hoisted.
- **`useEffect` is a last resort.** If you're using it to derive state, you probably want `useMemo` or a computed value. If you're using it for one-time setup, consider a server component or layout.
- **Custom hooks** for any logic reused across 2+ components.

## TypeScript

- **`strict: true` is non-negotiable.** No `any`. If you genuinely need an escape hatch, use `unknown` + a type guard.
- **Discriminated unions** for state and actions (see engine).
- **No `enum`.** Use `as const` literal unions.
- **Type-only imports** explicit: `import type { X } from '...'`.

## State management

- **Server state**: lives in Postgres, read via RSC or server actions, mutated via server actions.
- **Client UI state**: React state (useState) is the default.
- **Client game state**: Zustand store. One store per feature, not one mega-store.
- **Form state**: React's built-in `<form action={serverAction}>` + `useFormState`. Don't reach for `react-hook-form` until you need it.

## Server Actions

- One action per file in `src/server/actions/<feature>/<action>.ts`.
- First line: `'use server'`.
- Validate input with Zod before touching the DB.
- Wrap DB writes in a transaction when more than one statement.
- Return `{ ok: true, data }` or `{ ok: false, error }` — never throw to the client.

## Error handling

- **At the boundary, not in the middle.** Internal code trusts its callers. Validate at: user input, server action entry, realtime payload receipt.
- **Throw on invariant violations** (engine, internal helpers). Catch only where you can recover meaningfully.
- **Don't swallow errors.** If you catch, log via the project logger AND re-throw or convert to a user-facing message.

## Comments

- Default: no comments. Good names are documentation.
- Exception: WHY comments for non-obvious decisions (workaround for a bug, subtle invariant, performance hack).
- Never write a comment that restates what the code does.
- JSDoc only on exported public APIs that other modules consume.

## Tailwind

- **Sort classes with the official Tailwind ESLint plugin** (auto-fix on save).
- **`cn(...)` for conditional classes** using `clsx` + `tailwind-merge`.
- **Component-specific design tokens go in `tailwind.config`**, not inline magic numbers.
- Avoid arbitrary values (`w-[37px]`) when a spacing scale value (`w-9`) exists.

## Commits

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`.
- Subject ≤ 50 chars. Body explains WHY if not obvious.
- One logical change per commit. Don't bundle a refactor with a feature.

## Pull Requests

- Title: same as commit subject style.
- Body: "What changed, why, how to test." Three sections, brief.
- One reviewer minimum. Self-review the diff before requesting.
- Keep PRs under ~400 lines of diff when possible. Split if larger.

## Testing

- **Unit test the engine.** It's pure, easy to test, and the most important code in the app.
- **Integration test server actions.** Real DB, real auth.
- **E2E test the multiplayer happy path.** Two browser contexts, Playwright.
- **Don't unit test React components** beyond accessibility smoke tests. Components change too fast; cover them with E2E instead.

## Anti-patterns to avoid

- Mutating state objects (`tempState[i].coins += x` after a shallow copy). Either deep-clone or treat as immutable.
- "Smart" generic helpers used in one place. Inline it.
- Index signatures on objects that should be discriminated unions.
- `useEffect` for derived state.
- Magic strings. Constants live in `src/game/rules.ts` or feature-local `constants.ts`.
- Putting business logic in components.
