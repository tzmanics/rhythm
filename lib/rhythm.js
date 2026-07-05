/* ============================================================
   RHYTHM — core logic (pure, no I/O, no React)
   Two data types:   Goal (a rule)  +  Completion (a log entry)
   One core function: computeDay(goals, completions, date)
   Everything on screen is derived. Nothing is ever "moved."
   ============================================================ */

/* ---------- dates (day boundary = 4:00 AM) ---------- */

export const RACE_DATE = "2026-10-18"; // your race day
export const RACE_NAME = "race day";   // e.g. "Columbus" — shown in the countdown pill
export const DOW = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const pad = (n) => String(n).padStart(2, "0");
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromStr = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = fromStr(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
};
export const daysBetween = (a, b) => Math.round((fromStr(b) - fromStr(a)) / 86400000);
// A 5:30am runner's "day" shouldn't flip at midnight.
export const effectiveToday = () => toStr(new Date(Date.now() - 4 * 3600 * 1000));
export const prettyDate = (s) =>
  fromStr(s).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
export const shortDate = (s) =>
  fromStr(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
export const nowHM = () => {
  const n = new Date();
  return `${pad(n.getHours())}:${pad(n.getMinutes())}`;
};

/* ---------- recurrence: two semantics ----------
   Calendar rules (daily / weekly / monthly / weekdays / alternate) keep
   rhythm: due once per cycle, from the occurrence until completed.
   Interval rules drift with you: due N days after the LAST completion,
   optionally snapping to a preferred weekday.                          */

const lastCompletion = (goalId, comps) => {
  let best = null;
  for (const c of comps)
    if (c.goalId === goalId && (!best || c.date > best.date)) best = c;
  return best;
};
const completedIn = (goalId, comps, from, to) =>
  comps.some((c) => c.goalId === goalId && c.date >= from && c.date <= to);
const snapToDOW = (dateStr, day) => {
  for (let i = 0; i < 7; i++) {
    const d = addDays(dateStr, i);
    if (DOW[fromStr(d).getDay()] === day) return d;
  }
  return dateStr;
};

// Most recent calendar occurrence on or before `date`.
function occurrenceOnOrBefore(rule, date) {
  if (rule.type === "weekly") {
    for (let i = 0; i < 7; i++) {
      const d = addDays(date, -i);
      if (rule.days.includes(DOW[fromStr(d).getDay()])) return d;
    }
  }
  if (rule.type === "monthly") {
    const d = fromStr(date);
    if (d.getDate() >= rule.day)
      return toStr(new Date(d.getFullYear(), d.getMonth(), rule.day));
    return toStr(new Date(d.getFullYear(), d.getMonth() - 1, rule.day));
  }
  return null;
}

// Is this goal due on `date`? Returns {due, overdueDays}.
export function dueOn(goal, comps, date) {
  const none = { due: false, overdueDays: 0 };
  if (goal.pausedUntil && date < goal.pausedUntil) return none; // vacation mode
  const r = goal.rule;

  if (r.type === "daily")
    return { due: !completedIn(goal.id, comps, date, date), overdueDays: 0 };

  if (r.type === "alternate") {
    // Fitness parity: due only on its day. A miss is absorbed by the
    // training plan regenerating — never stacked onto tomorrow.
    const onDay = ((daysBetween(r.anchor, date) % 2) + 2) % 2 === 0;
    if (!onDay) return none;
    return { due: !completedIn(goal.id, comps, date, date), overdueDays: 0 };
  }

  if (r.type === "weekdays") {
    // Daily on selected weekdays (school runs). A miss doesn't carry over —
    // yesterday's drop-off can't be done today.
    if (!r.days.includes(DOW[fromStr(date).getDay()])) return none;
    return { due: !completedIn(goal.id, comps, date, date), overdueDays: 0 };
  }

  if (r.type === "interval") {
    const last = lastCompletion(goal.id, comps);
    let start = last ? addDays(last.date, r.everyN) : r.from || date;
    // Optional preferred weekday: the due date snaps forward to it, so
    // "every 14 days, Saturdays" drifts with you but lands on a Saturday.
    if (r.preferredDay) start = snapToDOW(start, r.preferredDay);
    return { due: date >= start, overdueDays: Math.max(0, daysBetween(start, date)) };
  }

  if (r.type === "weekly" || r.type === "monthly") {
    const occ = occurrenceOnOrBefore(r, date);
    if (!occ || date < occ) return none;
    // 2-day grace: doing it a little early still clears this cycle.
    const done = completedIn(goal.id, comps, addDays(occ, -2), date);
    return { due: !done, overdueDays: daysBetween(occ, date) };
  }
  return none;
}

/* ---------- marathon plan (pure, regenerates on every miss) ----------
   Base = last completed run's distance & date (default 4 mi).
   Easy runs grow ~8%/week from there; the weekend run day is the long
   run; taper inside two weeks; race day is race day. Simple on purpose —
   this one function IS the training plan, swap it to change philosophy. */

export function runMiles(goal, comps, date) {
  if (date === RACE_DATE) return 26.2;
  const runs = comps
    .filter((c) => c.goalId === goal.id && c.value)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = runs[runs.length - 1];
  const base = last ? Number(last.value) : goal.baseMiles || 4;
  const baseDate = last ? last.date : goal.rule.anchor;
  const weeks = Math.max(0, Math.floor(daysBetween(baseDate, date) / 7));
  let miles = Math.min(base * Math.pow(1.08, weeks), 9);
  const dow = fromStr(date).getDay();
  if (dow === 0 || dow === 6) miles = Math.min(miles * 1.8, 20); // long run
  const toRace = daysBetween(date, RACE_DATE);
  if (toRace <= 7) miles *= 0.4;
  else if (toRace <= 14) miles *= 0.65;
  return Math.max(2, Math.round(miles * 2) / 2);
}

/* ---------- the day, computed ---------- */

export const BLOCKS = [
  { id: "early", label: "Early morning", from: "04:00" },
  { id: "morning", label: "Morning", from: "08:00" },
  { id: "midday", label: "Midday", from: "12:00" },
  { id: "afternoon", label: "Afternoon", from: "15:00" },
  { id: "evening", label: "Evening", from: "18:30" },
];
export const blockForTime = (t) => {
  let b = BLOCKS[BLOCKS.length - 1];
  for (const blk of BLOCKS) if (t >= blk.from) b = blk;
  return t < "04:00" ? "evening" : b.id;
};

export function computeDay(goals, comps, date) {
  const items = [];
  for (const g of goals) {
    const { due, overdueDays } = dueOn(g, comps, date);
    const doneToday = completedIn(g.id, comps, date, date);
    if (!due && !doneToday) continue;
    items.push({
      goal: g,
      done: doneToday,
      overdueDays,
      miles: g.plan === "marathon" ? runMiles(g, comps, date) : null,
    });
  }
  const byBlock = {};
  for (const b of BLOCKS) byBlock[b.id] = [];
  for (const it of items) {
    const blk = it.goal.anchor ? blockForTime(it.goal.anchor) : it.goal.block || "morning";
    byBlock[blk].push(it);
  }
  for (const b of BLOCKS)
    byBlock[b.id].sort((x, y) => {
      if (x.goal.anchor && y.goal.anchor) return x.goal.anchor < y.goal.anchor ? -1 : 1;
      if (x.goal.anchor) return -1;
      if (y.goal.anchor) return 1;
      return y.overdueDays - x.overdueDays; // stalest first
    });
  return byBlock;
}

export const ruleLabel = (g) => {
  const r = g.rule;
  if (r.type === "daily") return "daily";
  if (r.type === "alternate") return "every other day";
  if (r.type === "weekdays") return r.days.join(" ");
  if (r.type === "interval")
    return `every ${r.everyN}d${r.preferredDay ? ` · ${r.preferredDay}` : ""}`;
  if (r.type === "weekly") return `weekly · ${r.days.join(" ")}`;
  if (r.type === "monthly") return `monthly · day ${r.day}`;
  return "";
};

/* ---------- seed data, transcribed from the household spreadsheet ----------
   [title, preferredDay, minutes]. Long-cycle tasks get staggered start
   dates so quarterly/yearly work trickles in instead of flooding week one.
   Goals here have no ids — the database assigns them on insert.          */

const WEEKLY_TASKS = [
  ["Empty diaper pail", "MO", 5],
  ["Clean laundry room", "TU", 15],
  ["Clean out the fridge", "FR", 20],
  ["Deep clean upstairs rooms (4 × 15 min)", "SU", 60],
];

const CYCLE_TASKS = [
  { everyN: 14, spread: (i) => (i % 2) * 7, tasks: [
    ["Deep clean downstairs bathroom", "SA", 30],
    ["Deep clean upstairs bathroom", "SA", 30],
    ["Clean microwave", "SU", 15],
    ["Change sheets (all beds)", "SU", 30],
    ["Clean sunroom", "WE", 20],
    ["Dust downstairs", "WE", 15],
    ["Dust upstairs", "TH", 15],
    ["Clean dishwasher filter", "TH", 10],
  ]},
  { everyN: 30, spread: (i) => (i % 4) * 7, tasks: [
    ["Wipe baseboards (all rooms)", "WE", 45],
    ["Vacuum and mop upstairs", "WE", 30],
    ["Vacuum and mop downstairs", "WE", 30],
    ["Clean and organize lockers", "TH", 20],
    ["Clean laundry room (deep)", "TH", 30],
    ["Wash couch cushions", "TH", 30],
    ["Vacuum stairs", "TH", 15],
  ]},
  { everyN: 91, spread: (i) => i * 5, tasks: [
    ["Clean out freezer", "SA", 30],
    ["Clean windows (interior)", "SA", 60],
    ["Clean ceiling fans (all rooms)", "SA", 30],
    ["Clean inside cabinets", "SA", 45],
    ["Clean oven", "SU", 45],
    ["Clean kids closets", "SU", 30],
    ["Clean out kids bookshelves", "SU", 30],
    ["Wipe kitchen cabinets", "SU", 30],
    ["Organize craft bins", "WE", 30],
    ["Wash comforters", "WE", 60],
    ["Descale tea and coffee maker", "WE", 20],
    ["Clean fridge (deep)", "WE", 45],
    ["Wipe downstairs walls", "TH", 45],
    ["Wipe upstairs walls", "TH", 45],
    ["Clean under craft bins", "TH", 20],
    ["Clean shower curtains", "TH", 15],
  ]},
  { everyN: 182, spread: (i) => 30 + i * 25, tasks: [
    ["Organize kids clothes", "SA", 60],
    ["Clean out dressers", "SA", 45],
    ["Clean upstairs bathroom drawers", "WE", 30],
    ["Clean out guest desk", "WE", 30],
    ["Shampoo stairs", "TH", 45],
    ["Clean under lockers", "TH", 30],
  ]},
  { everyN: 365, spread: (i) => 60 + i * 20, tasks: [
    ["Clean out guest closet", "SA", 45],
    ["Clean freezer (deep)", "SA", 60],
    ["Clean kitchen cabinets (deep)", "SA", 90],
    ["Clean hall closet", "SA", 30],
    ["Clean laundry room closet", "SA", 30],
    ["Clean coat closet", "WE", 30],
    ["Clean bookshelf", "WE", 45],
    ["Clean music instruments", "WE", 30],
    ["Clean balls", "WE", 15],
    ["Clean out credenza", "WE", 30],
    ["Clean out primary desk", "TH", 45],
    ["Clean out primary credenza", "TH", 30],
    ["Clean out primary closet", "TH", 60],
    ["Clean out bathroom closet", "TH", 30],
    ["Clean out bathroom cupboards", "TH", 30],
  ]},
];

const SCHOOL_START = "2026-08-17"; // adjust to the real first day
const SCHOOL_DAYS = ["MO", "TU", "WE", "TH", "FR"];

export function SEEDS() {
  const seedDay = effectiveToday();
  const g = [];
  const add = (o) => g.push({ category: "chores", ...o });

  /* fixed rhythm of the day (summer schedule) */
  add({ title: "Marathon run", category: "fitness", rule: { type: "alternate", anchor: seedDay }, anchor: "05:30", plan: "marathon", baseMiles: 4 });
  add({ title: "Walk + weights", category: "fitness", rule: { type: "alternate", anchor: addDays(seedDay, 1) }, anchor: "05:30" });
  add({ title: "Kids up + breakfast", category: "kids", rule: { type: "daily" }, anchor: "08:00" });
  add({ title: "Daily house pickup (11 rooms)", rule: { type: "daily" }, block: "morning", minutes: 110 });
  add({ title: "Lunch", category: "kids", rule: { type: "daily" }, anchor: "12:00" });
  add({ title: "Make dinner", rule: { type: "daily" }, anchor: "17:30", minutes: 60 });
  add({ title: "Dinner", category: "kids", rule: { type: "daily" }, anchor: "18:30" });
  add({ title: "Bath routine", category: "kids", rule: { type: "daily" }, anchor: "19:30" });
  add({ title: "Clean kitchen after dinner", rule: { type: "daily" }, block: "evening" });
  add({ title: "Fold laundry", rule: { type: "daily" }, block: "evening", minutes: 30 });
  add({ title: "Water the plants", rule: { type: "interval", everyN: 7, from: addDays(seedDay, 4) }, block: "morning" });
  add({ title: "Order groceries", rule: { type: "weekly", days: ["SU"] }, block: "afternoon" });

  /* school-year routine — paused until school starts. Titles are generic
     on purpose: after your first sign-in these are rows in YOUR database,
     so rename them in Edit goals and the repo stays clean. */
  const school = (title, anchor, category = "kids") =>
    add({ title, category, rule: { type: "weekdays", days: SCHOOL_DAYS }, anchor, pausedUntil: SCHOOL_START });
  school("Make breakfast, pack lunches", "06:45");
  school("Wake up kids (school)", "07:00");
  school("Leave for school", "07:50");
  school("Drop-off — kid 1", "08:15");
  school("Drop-off — kid 2", "08:25");
  school("Midday pickup — kid 2", "11:15");
  school("Walk for afternoon pickup", "14:55");

  /* weekly tasks: calendar rules — they keep their weekday */
  for (const [title, day, minutes] of WEEKLY_TASKS)
    add({ title, rule: { type: "weekly", days: [day] }, minutes,
          block: day === "SA" || day === "SU" ? "morning" : "midday" });

  /* longer cycles: interval rules — they drift with you, snapping to a
     preferred weekday. */
  for (const c of CYCLE_TASKS)
    c.tasks.forEach(([title, day, minutes], i) =>
      add({ title, minutes,
            rule: { type: "interval", everyN: c.everyN, preferredDay: day, from: addDays(seedDay, c.spread(i)) },
            block: day === "SA" || day === "SU" ? "morning" : "midday" }));

  return g;
}
