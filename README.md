# Rhythm ᕕ( ᐛ )ᕗ

**An adaptive household schedule that never needs rescheduling.**

Rhythm runs a real household day — kid anchors, meals, chores on every cycle
from daily to yearly, and a marathon training plan — on two data types and
one pure function. Miss something? Nothing gets "moved," because nothing is
stored per-day: tomorrow is simply *computed*, and the miss is already
absorbed. ┬─┬ノ( º _ ºノ)

```
Goals (rules)  +  Completions (a log)  →  computeDay(goals, completions, date)
```

That's the whole system. Everything on screen is derived, fresh, every time.

## What it does (◕‿◕)

- **Time-blocked days** — fixed anchors (dinner at 6:30) pinned to their
  times, flexible tasks floating in morning/midday/evening blocks
- **Two recurrence semantics, on purpose**
  - *Calendar rules* keep rhythm: "groceries every Sunday" done late on
    Monday is still due next **Sunday**
  - *Interval rules* drift with you: "water plants every 7 days" counts from
    the last time you actually watered
- **A marathon plan that regenerates** ᕙ(⇀‸↼‶)ᕗ — miss a run and the
  remaining plan rebuilds from your last completed distance to race day.
  No guilt stacking, no manual replanning
- **Misses that shouldn't carry, don't** — a skipped school drop-off doesn't
  show up twice tomorrow
- **Vacation mode** ( ˘▽˘)ノ — pause any goal until a date; come home to a
  normal day, not a wall of overdue chores
- **Ask your schedule** — "when did I last clean the fridge?" answered by
  Claude straight off your completion log
- **Capacity awareness** — duration estimates roll up into a per-day
  chore-load total, so you can see an overloaded Thursday coming (ಠ_ಠ)
- **Installable PWA** with sign-in via email magic link, Google, or GitHub

## Run your own (ノ^_^)ノ

You need free-tier accounts at [Supabase](https://supabase.com) and
[Vercel](https://vercel.com), plus an Anthropic API key for the Ask box
([docs.claude.com/en/api/overview](https://docs.claude.com/en/api/overview)).

1. **Supabase**: create a project → SQL Editor → run `supabase/schema.sql`
   (two tables, row-level security — that's the whole database)
2. **Auth**: email links work out of the box. For Google/GitHub, register an
   OAuth app pointing at
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` and enable the
   provider in Supabase
3. **Locally**:
   ```bash
   npm install
   cp .env.example .env.local   # paste your Supabase URL, anon key, Anthropic key
   npm run dev
   ```
4. **Deploy**: push to GitHub → import on Vercel → add the same three env
   vars → set the Vercel URL as your Site URL in Supabase auth settings
5. On your phone: open the URL → **Add to Home Screen**

First sign-in seeds a full example household. From that moment the goals are
rows in *your* database — rename "Drop-off — kid 1" to your actual kid,
change the race name in `lib/rhythm.js`, delete what you don't need. The
seeds are just a starting point. ¯\\\_(ツ)\_/¯

## For developers (⌐■_■)

```
lib/rhythm.js          ALL logic — recurrence, marathon plan, computeDay (pure, no I/O)
lib/store.js           the ONLY file that talks to the database
lib/supabase.js        client singleton
components/Rhythm.jsx  the one screen
components/Auth.jsx    sign-in
app/api/ask/route.js   Ask box, server-side (API key never ships to the browser)
supabase/schema.sql    the whole database
test/rhythm.test.mjs   22 tests specifying every behavior above
```

The design bet is **derived state**: because due-ness is computed from the
completion log rather than stored, there are no rollover jobs, no task-moving
logic, and no state to corrupt. Undo is deleting a row. History, streaks, and
"when did I last…" are queries over the log. Previewing race week is just
calling `computeDay` with a future date.

Everything in `lib/rhythm.js` is a pure function over
`(goals, completions, date)` — which is why the test suite runs in
milliseconds with no mocks:

```bash
npm test
```

Want a different training philosophy? `runMiles` is one swappable function.
Different backend? `lib/store.js` is six small functions. New recurrence
type? One branch in `dueOn`, a label in `ruleLabel`, and a test.

## Roadmap (☞ﾟヮﾟ)☞

- **Household mode** — shared goals, multiple check-offs, live sync via
  Supabase realtime (the schema comments mark the one change needed)
- Editable run distances at check-off time
- Pluggable training-plan engines

## Contributing (ง'̀-'́)ง

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The short version:
keep the core small, keep logic pure, and bring a test.
