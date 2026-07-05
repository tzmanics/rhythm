# Contributing to Rhythm (ง'̀-'́)ง

Thanks for wanting to help! Rhythm is deliberately small, and staying small
is the feature. This guide explains the design principles that keep it that
way and the mechanics of getting a change merged.

## Design principles — read this first (⌐■_■)

Every contribution is weighed against these. They're what make the codebase
pleasant to live in:

1. **Derived state, always.** The database stores rules (`goals`) and history
   (`completions`). Everything else — due-ness, overdue counts, the training
   plan, future days — is computed on the fly. If your feature wants to
   *store* schedule state, first ask whether it can be *derived* instead. It
   almost always can, and the derived version has no migrations, no rollover
   jobs, and no way to corrupt.

2. **Logic stays pure.** `lib/rhythm.js` has no I/O, no React, no globals —
   just functions over `(goals, completions, date)`. That's why the whole
   test suite runs in milliseconds with zero mocks. Keep it that way.

3. **One file talks to the database.** `lib/store.js` is the entire backend
   surface. UI components never import Supabase directly.

4. **Few moving parts beats many features.** A new capability should usually
   be a new *field* or a new *branch*, not a new subsystem. Good examples
   from the project's history: vacation mode is one optional `pausedUntil`
   field; preferred weekdays on interval tasks is one `snapToDOW` call.

5. **Legibility is a requirement.** Plain JavaScript, small functions,
   comments that explain *why* (the non-obvious semantics), not *what*.

## Where things go ( ˙▿˙ )

| You want to… | Touch |
| --- | --- |
| Add a recurrence type | One branch in `dueOn`, a case in `ruleLabel`, tests |
| Change training philosophy | Replace `runMiles` (keep its signature) |
| Support a new backend | Reimplement `lib/store.js`'s six functions |
| Change the day layout | `BLOCKS` / `computeDay` in `lib/rhythm.js` |
| Restyle | CSS variables at the top of `app/globals.css` |
| Add UI | `components/` — keep logic out of components |

## Getting set up (ノ^_^)ノ

```bash
git clone <your-fork>
cd rhythm
npm install
cp .env.example .env.local   # your own Supabase project + Anthropic key
npm run dev
```

You'll need a free Supabase project with `supabase/schema.sql` applied — see
the README. For pure-logic changes you don't need any of that:

```bash
npm test    # Node's built-in runner, no test dependencies
```

## Tests (ᕗ ͠° ਊ ͠° )ᕗ

- **Logic changes require tests.** The suite in `test/rhythm.test.mjs` is a
  specification: each test pins a designed behavior (weekly keeps its
  weekday; interval drifts; misses that shouldn't carry, don't). If you
  change behavior, change the test *and say why in the PR* — some of these
  semantics are subtle and were chosen deliberately.
- Date-math changes should include a case around a month/year/DST boundary.
  November has caught a scheduler or two before. (╯°□°）╯︵ ┻━┻
- UI-only changes don't need tests, but `npm run build` must pass.

## Pull requests

1. Fork, branch from `main` (`feat/…`, `fix/…`).
2. Keep PRs focused — one behavior per PR.
3. `npm test` and `npm run build` both green.
4. In the description, say **what behavior changed and why**, not just what
   code changed. For anything touching recurrence semantics or the training
   plan, include a before/after example day.
5. Small PRs get reviewed fast. Big ones get questions.

## Bugs (ಠ_ಠ)

Open an issue with: the goal's rule (JSON is perfect), the relevant
completion dates, the date you viewed, what you expected, and what you got.
Because everything is derived, that tuple reproduces any scheduling bug
exactly.

## Feature ideas (¬‿¬)

Open an issue before building anything sizable. Ideas that fit the roadmap
(household mode, pluggable training engines, editable run distances) are
especially welcome. The bar for new concepts is high; the bar for making
existing concepts compose better is low.
