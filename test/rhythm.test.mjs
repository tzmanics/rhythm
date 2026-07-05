/* Unit tests for the core logic (lib/rhythm.js).
   Runs on Node's built-in test runner — zero test dependencies:
       npm test
   The logic is pure functions over (goals, completions, date), so every
   behavior we designed is directly assertable. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays, daysBetween, dueOn, runMiles, computeDay, blockForTime,
  RACE_DATE,
} from "../lib/rhythm.js";

/* ---------- helpers ---------- */
const goal = (rule, extra = {}) => ({ id: "g1", title: "test", rule, ...extra });
const done = (date, extra = {}) => ({ goalId: "g1", date, ...extra });

/* ---------- date helpers ---------- */

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-07-31", 1), "2026-08-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("addDays is stable across the US DST transition", () => {
  // Nov 1 2026 is fall-back in America/New_York; day math must not drift.
  assert.equal(addDays("2026-10-31", 2), "2026-11-02");
  assert.equal(daysBetween("2026-10-31", "2026-11-02"), 2);
});

/* ---------- daily ---------- */

test("daily: due until completed, then not due", () => {
  const g = goal({ type: "daily" });
  assert.equal(dueOn(g, [], "2026-07-06").due, true);
  assert.equal(dueOn(g, [done("2026-07-06")], "2026-07-06").due, false);
  // ...and due again the next day
  assert.equal(dueOn(g, [done("2026-07-06")], "2026-07-07").due, true);
});

/* ---------- weekly (calendar: keeps its weekday) ---------- */

test("weekly: due from its weekday until completed", () => {
  const g = goal({ type: "weekly", days: ["WE"] }); // 2026-07-08 is a Wednesday
  const prior = [done("2026-07-01")]; // last week's cycle was completed
  assert.equal(dueOn(g, prior, "2026-07-07").due, false, "not due Tuesday");
  assert.equal(dueOn(g, prior, "2026-07-08").due, true, "due Wednesday");
  assert.equal(dueOn(g, prior, "2026-07-09").due, true, "missed → still due Thursday");
  assert.equal(dueOn(g, prior, "2026-07-09").overdueDays, 1);
  // with NO history at all, the previous cycle is still open — so it IS
  // due on Tuesday. That's the "missed items keep surfacing" behavior.
  assert.equal(dueOn(g, [], "2026-07-07").due, true);
});

test("weekly: doing it late keeps the rhythm — next one is still next Wednesday", () => {
  const g = goal({ type: "weekly", days: ["WE"] });
  const comps = [done("2026-07-09")]; // did Wednesday's task on Thursday
  assert.equal(dueOn(g, comps, "2026-07-10").due, false, "cleared for this cycle");
  assert.equal(dueOn(g, comps, "2026-07-15").due, true, "due again NEXT Wednesday");
});

test("weekly: 2-day early-completion grace clears the cycle", () => {
  const g = goal({ type: "weekly", days: ["WE"] });
  const comps = [done("2026-07-07")]; // did it Tuesday, a day early
  assert.equal(dueOn(g, comps, "2026-07-08").due, false);
});

test("weekly: multiple missed weeks collapse into being due once", () => {
  const g = goal({ type: "weekly", days: ["WE"] });
  // never completed, three Wednesdays have passed — due once, not three times
  const { due, overdueDays } = dueOn(g, [], "2026-07-23"); // Thu after 3rd Wed
  assert.equal(due, true);
  assert.equal(overdueDays, 1, "measured from the CURRENT cycle's Wednesday");
});

/* ---------- monthly ---------- */

test("monthly: due from day N, looks back to last month before it", () => {
  const g = goal({ type: "monthly", day: 15 });
  assert.equal(dueOn(g, [], "2026-07-14").due, true, "June 15 cycle still open");
  assert.equal(dueOn(g, [done("2026-06-15")], "2026-07-14").due, false);
  assert.equal(dueOn(g, [done("2026-06-15")], "2026-07-15").due, true, "new cycle");
});

/* ---------- interval (drifts with you) ---------- */

test("interval: due N days after the last completion, whenever that was", () => {
  const g = goal({ type: "interval", everyN: 7, from: "2026-07-08" });
  assert.equal(dueOn(g, [], "2026-07-07").due, false, "not before `from`");
  assert.equal(dueOn(g, [], "2026-07-08").due, true);
  // completed two days late → the whole cycle drifts
  const comps = [done("2026-07-10")];
  assert.equal(dueOn(g, comps, "2026-07-16").due, false);
  assert.equal(dueOn(g, comps, "2026-07-17").due, true, "7 days after actual watering");
});

test("interval: preferredDay snaps the due date to that weekday", () => {
  const g = goal({ type: "interval", everyN: 14, preferredDay: "SA", from: "2026-07-06" });
  // from is a Monday; first due should snap to Saturday 2026-07-11
  assert.equal(dueOn(g, [], "2026-07-10").due, false);
  assert.equal(dueOn(g, [], "2026-07-11").due, true);
  // completed that Saturday → next lands on a Saturday again (Jul 25)
  const comps = [done("2026-07-11")];
  assert.equal(dueOn(g, comps, "2026-07-24").due, false);
  assert.equal(dueOn(g, comps, "2026-07-25").due, true);
});

/* ---------- weekdays & alternate (misses do NOT carry over) ---------- */

test("weekdays: due only on listed days; a miss is gone the next day", () => {
  const g = goal({ type: "weekdays", days: ["MO", "TU", "WE", "TH", "FR"] });
  assert.equal(dueOn(g, [], "2026-07-06").due, true, "Monday");
  assert.equal(dueOn(g, [], "2026-07-04").due, false, "Saturday");
  // missing Monday's drop-off does not make Tuesday show two drop-offs
  assert.equal(dueOn(g, [], "2026-07-07").overdueDays, 0);
});

test("alternate: every-other-day parity from the anchor", () => {
  const g = goal({ type: "alternate", anchor: "2026-07-04" });
  assert.equal(dueOn(g, [], "2026-07-04").due, true);
  assert.equal(dueOn(g, [], "2026-07-05").due, false);
  assert.equal(dueOn(g, [], "2026-07-06").due, true);
  // parity works looking backward from the anchor too
  assert.equal(dueOn(g, [], "2026-07-02").due, true);
});

/* ---------- pause (vacation mode) ---------- */

test("pausedUntil suppresses due-ness until the date arrives", () => {
  const g = goal({ type: "daily" }, { pausedUntil: "2026-08-17" });
  assert.equal(dueOn(g, [], "2026-08-16").due, false);
  assert.equal(dueOn(g, [], "2026-08-17").due, true);
});

/* ---------- marathon plan ---------- */

const runGoal = goal(
  { type: "alternate", anchor: "2026-07-04" },
  { plan: "marathon", baseMiles: 4 }
);

test("runMiles: race day is 26.2", () => {
  assert.equal(runMiles(runGoal, [], RACE_DATE), 26.2);
});

test("runMiles: starts from the base with no history", () => {
  assert.equal(runMiles(runGoal, [], "2026-07-06"), 4); // weekday, week 0
});

test("runMiles: weekend runs are the long run", () => {
  const weekday = runMiles(runGoal, [], "2026-07-06"); // Monday
  const weekend = runMiles(runGoal, [], "2026-07-04"); // Saturday
  assert.ok(weekend > weekday, "long run exceeds easy run");
});

test("runMiles: the plan regenerates from the last completed run", () => {
  // A missed week doesn't stack mileage; a logged 6-miler resets the base.
  const comps = [{ goalId: "g1", date: "2026-08-01", value: 6 }];
  const twoWeeksOn = runMiles(runGoal, comps, "2026-08-17"); // weekday, +2 wks
  assert.ok(twoWeeksOn > 6, "grows from the new base");
  assert.ok(twoWeeksOn <= 9, "easy runs stay capped");
});

test("runMiles: tapers inside two weeks of the race", () => {
  const peak = runMiles(runGoal, [], addDays(RACE_DATE, -21)); // outside taper
  const taper = runMiles(runGoal, [], addDays(RACE_DATE, -10));
  const raceWeek = runMiles(runGoal, [], addDays(RACE_DATE, -5));
  assert.ok(taper < peak, "two weeks out is reduced");
  assert.ok(raceWeek < taper, "race week is reduced further");
});

/* ---------- computeDay ---------- */

test("computeDay: anchored goals land in the right block, in time order", () => {
  const goals = [
    { id: "a", title: "Dinner", rule: { type: "daily" }, anchor: "18:30" },
    { id: "b", title: "Run", rule: { type: "daily" }, anchor: "05:30" },
    { id: "c", title: "Make dinner", rule: { type: "daily" }, anchor: "17:30" },
  ];
  const day = computeDay(goals, [], "2026-07-06");
  assert.equal(day.early.length, 1);
  assert.equal(day.early[0].goal.id, "b");
  assert.equal(day.afternoon[0].goal.id, "c", "17:30 is afternoon");
  assert.equal(day.evening[0].goal.id, "a", "18:30 starts evening");
});

test("computeDay: flexible overdue items sort stalest-first", () => {
  const goals = [
    { id: "fresh", title: "fresh", rule: { type: "interval", everyN: 7, from: "2026-07-05" }, block: "morning" },
    { id: "stale", title: "stale", rule: { type: "interval", everyN: 7, from: "2026-07-01" }, block: "morning" },
  ];
  const day = computeDay(goals, [], "2026-07-06");
  assert.deepEqual(day.morning.map((i) => i.goal.id), ["stale", "fresh"]);
});

test("computeDay: completed items remain visible as done", () => {
  const goals = [{ id: "g1", title: "Lunch", rule: { type: "daily" }, anchor: "12:00" }];
  const day = computeDay(goals, [done("2026-07-06")], "2026-07-06");
  assert.equal(day.midday.length, 1);
  assert.equal(day.midday[0].done, true);
});

test("blockForTime: late night belongs to evening, not early morning", () => {
  assert.equal(blockForTime("23:30"), "evening");
  assert.equal(blockForTime("02:00"), "evening");
  assert.equal(blockForTime("04:00"), "early");
});
