"use client";
import { useState, useEffect } from "react";
import {
  BLOCKS, RACE_DATE, RACE_NAME, DOW,
  addDays, daysBetween, effectiveToday, prettyDate, shortDate, nowHM,
  computeDay, blockForTime, ruleLabel, restartPlan,
} from "../lib/rhythm";
import * as store from "../lib/store";

export default function Rhythm({ onSignOut }) {
  const [goals, setGoals] = useState(null);
  const [comps, setComps] = useState([]);
  const [today, setToday] = useState(effectiveToday());
  const [editing, setEditing] = useState(false);
  const [ask, setAsk] = useState("");
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [undo, setUndo] = useState(null); // {count, prev: [goal, ...]}

  useEffect(() => {
    store
      .loadAll()
      .then(({ goals, completions }) => {
        setGoals(goals);
        setComps(completions);
      })
      .catch((e) => setLoadError(e.message));
    const t = setInterval(() => setToday(effectiveToday()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);

  if (loadError)
    return (
      <div className="rhythm">
        <div className="loading">
          Couldn't load your schedule ({loadError}). Refresh to try again.
        </div>
      </div>
    );
  if (!goals)
    return (
      <div className="rhythm">
        <div className="loading">Opening the day…</div>
      </div>
    );

  /* Optimistic writes: the UI updates instantly, the log write follows. */
  const toggle = (item, date) => {
    if (item.done) {
      setComps(comps.filter((c) => !(c.goalId === item.goal.id && c.date === date)));
      store.deleteCompletion(item.goal.id, date).catch(console.error);
    } else {
      const c = { goalId: item.goal.id, date };
      if (item.miles) c.value = item.miles;
      setComps([...comps, c]);
      store.addCompletion(c).catch(console.error);
    }
  };

  /* Restart: push past-due chores out to fresh dates. No completions logged. */
  const plan = today === effectiveToday() ? restartPlan(goals, comps, today) : [];
  const restart = () => {
    const byId = new Map(plan.map((p) => [p.id, p.deferredTo]));
    const prev = goals.filter((g) => byId.has(g.id));
    const next = goals.map((g) => (byId.has(g.id) ? { ...g, deferredTo: byId.get(g.id) } : g));
    setGoals(next);
    next.filter((g) => byId.has(g.id)).forEach((g) => store.updateGoal(g).catch(console.error));
    setConfirming(false);
    setUndo({ count: prev.length, prev });
  };
  const undoRestart = () => {
    const prevById = new Map(undo.prev.map((g) => [g.id, g]));
    setGoals(goals.map((g) => prevById.get(g.id) ?? g));
    undo.prev.forEach((g) => store.updateGoal(g).catch(console.error));
    setUndo(null);
  };

  const askClaude = async () => {
    const q = ask.trim();
    if (!q || asking) return;
    setAsking(true);
    setAnswer(null);
    try {
      const week = {};
      for (let i = 0; i < 7; i++) {
        const d = addDays(today, i);
        const day = computeDay(goals, comps, d);
        week[d] = BLOCKS.flatMap((b) =>
          day[b.id].map((it) => it.goal.title + (it.miles ? ` (${it.miles} mi)` : ""))
        );
      }
      const payload = {
        today,
        raceDate: RACE_DATE,
        goals: goals.map((g) => ({
          title: g.title, category: g.category,
          rule: ruleLabel(g), pausedUntil: g.pausedUntil,
        })),
        completionLog: comps.slice(-250),
        upcomingWeek: week,
      };
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, payload }),
      });
      const data = await res.json();
      setAnswer(data.text || "No answer came back — try rephrasing.");
    } catch {
      setAnswer("Couldn't reach the assistant. Check your connection and ask again.");
    }
    setAsking(false);
  };

  const nowBlock = today === effectiveToday() ? blockForTime(nowHM()) : null;
  const dayData = computeDay(goals, comps, today);
  const toRace = daysBetween(today, RACE_DATE);

  return (
    <div className="rhythm">
      <header>
        <div className="masthead">
          <span className="mast-title"><span className="mast-dot" />Rhythm</span>
          <span className="mast-actions">
            {plan.length > 0 && !confirming && (
              <button className="edit-btn" onClick={() => setConfirming(true)}>
                Restart
              </button>
            )}
            <button className="edit-btn" onClick={() => setEditing(!editing)}>
              {editing ? "Done editing" : "Edit goals"}
            </button>
          </span>
        </div>
        {confirming && (
          <div className="restart-confirm" role="alertdialog" aria-label="Confirm restart">
            <span>Restart {plan.length} past-due {plan.length === 1 ? "item" : "items"}?</span>
            <button className="edit-btn" onClick={restart}>Restart</button>
            <button className="edit-btn" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        )}
        <h1>{prettyDate(today).split(",")[0]}</h1>
        <div className="date-row">
          <span className="date-sub">{prettyDate(today).split(", ").slice(1).join(", ")}</span>
          <span className="race-pill">
            {toRace > 0 ? `${toRace} days to ${RACE_NAME}` : toRace === 0 ? "Race day!" : "Marathon done"}
          </span>
        </div>
      </header>

      {editing && <GoalEditor goals={goals} setGoals={setGoals} />}

      <section className="today">
        {BLOCKS.map((b) => (
          <DayBlock
            key={b.id}
            block={b}
            items={dayData[b.id]}
            isNow={nowBlock === b.id}
            onToggle={(it) => toggle(it, today)}
          />
        ))}
      </section>

      <section className="ask">
        <div className="ask-row">
          <input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && askClaude()}
            placeholder="Ask the schedule — “when did I last clean the fridge?”"
            aria-label="Ask a question about your schedule"
          />
          <button onClick={askClaude} disabled={asking}>
            {asking ? "…" : "Ask"}
          </button>
        </div>
        {answer && <p className="answer">{answer}</p>}
      </section>

      <section className="strip">
        <div className="strip-label">Next three days</div>
        {[1, 2, 3].map((i) => {
          const d = addDays(today, i);
          const dd = computeDay(goals, comps, d);
          const load = BLOCKS.reduce(
            (m, b) => m + dd[b.id].reduce((s, it) => s + (it.goal.minutes || 0), 0),
            0
          );
          return (
            <div className="card" key={d}>
              <div className="card-date">
                {shortDate(d)}
                {load > 0 && <span className="card-load">{load} min of chores</span>}
              </div>
              {BLOCKS.map((b) =>
                dd[b.id].length ? (
                  <div key={b.id} className="card-block">
                    <span className="card-block-label">{b.label}</span>
                    {dd[b.id].map((it) => (
                      <div key={it.goal.id} className="card-item">
                        {it.goal.anchor && <span className="t">{it.goal.anchor}</span>}
                        {it.goal.title}
                        {it.miles ? <span className="mi"> — {it.miles} mi</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null
              )}
            </div>
          );
        })}
      </section>

      {undo && (
        <div className="toast" role="status">
          Restarted {undo.count} {undo.count === 1 ? "item" : "items"}
          <button onClick={undoRestart}>Undo</button>
        </div>
      )}

      <footer>
        Goals + a completion log. Everything else is computed. ·{" "}
        <button className="signout" onClick={onSignOut}>Sign out</button>
      </footer>
    </div>
  );
}

function DayBlock({ block, items, isNow, onToggle }) {
  const [showAll, setShowAll] = useState(false);
  if (!items.length) return null;
  const CAP = 6;
  const shown = showAll ? items : items.slice(0, CAP);
  return (
    <div className={"block" + (isNow ? " now" : "")}>
      <div className="block-head">
        <span className="block-label">{block.label}</span>
        <span className="block-time">{block.from}</span>
        {isNow && <span className="now-tag">now</span>}
      </div>
      {shown.map((it) => (
        <label
          key={it.goal.id}
          className={`item cat-${it.goal.category || "chores"}${it.done ? " done" : ""}`}
        >
          <input
            type="checkbox"
            checked={it.done}
            onChange={() => onToggle(it)}
            aria-label={it.goal.title}
          />
          <span className="item-title">
            {it.goal.anchor && <span className="t">{it.goal.anchor}</span>}
            {it.goal.title}
            {it.miles ? <span className="mi"> — {it.miles} mi</span> : null}
            {it.goal.minutes ? <span className="min"> · {it.goal.minutes}m</span> : null}
          </span>
          {it.overdueDays > 0 && (
            <span className="overdue">{it.overdueDays}d over</span>
          )}
        </label>
      ))}
      {items.length > CAP && (
        <button className="more" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `+${items.length - CAP} more waiting`}
        </button>
      )}
    </div>
  );
}

/* ---------- goal editor ---------- */

function GoalEditor({ goals, setGoals }) {
  const [f, setF] = useState({
    title: "", category: "chores", ruleType: "daily",
    day: "SU", everyN: 7, monthDay: 1, anchor: "", block: "morning", minutes: "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const add = async () => {
    if (!f.title.trim()) return;
    let rule;
    if (f.ruleType === "daily") rule = { type: "daily" };
    if (f.ruleType === "weekly") rule = { type: "weekly", days: [f.day] };
    if (f.ruleType === "interval")
      rule = { type: "interval", everyN: Math.max(2, +f.everyN || 7), from: effectiveToday() };
    if (f.ruleType === "monthly")
      rule = { type: "monthly", day: Math.min(28, Math.max(1, +f.monthDay || 1)) };
    const g = { title: f.title.trim(), category: f.category, rule };
    if (f.anchor) g.anchor = f.anchor;
    else g.block = f.block;
    if (+f.minutes > 0) g.minutes = +f.minutes;
    try {
      const saved = await store.addGoal(g);
      setGoals([...goals, saved]);
      setF({ ...f, title: "" });
    } catch (e) {
      console.error(e);
    }
  };

  const remove = (id) => {
    setGoals(goals.filter((g) => g.id !== id));
    store.deleteGoal(id).catch(console.error);
  };
  const pause = (id) => {
    const until = window.prompt("Pause until (YYYY-MM-DD)? Leave blank to unpause.");
    const next = goals.map((g) =>
      g.id === id ? { ...g, pausedUntil: until || undefined } : g
    );
    setGoals(next);
    store.updateGoal(next.find((g) => g.id === id)).catch(console.error);
  };

  return (
    <section className="editor">
      <div className="editor-list">
        {goals.map((g) => (
          <div className="erow" key={g.id}>
            <span className="erow-main">
              {g.title}
              <span className="erow-rule">
                {ruleLabel(g)}
                {g.anchor ? ` · ${g.anchor}` : ""}
                {g.pausedUntil ? ` · paused until ${g.pausedUntil}` : ""}
              </span>
            </span>
            <button onClick={() => pause(g.id)} title="Pause">‖</button>
            <button onClick={() => remove(g.id)} title="Delete">×</button>
          </div>
        ))}
      </div>
      <div className="editor-form">
        <input placeholder="New goal — e.g. Write a letter" value={f.title} onChange={set("title")} />
        <div className="form-row">
          <select value={f.category} onChange={set("category")}>
            <option value="kids">kids</option>
            <option value="chores">chores</option>
            <option value="fitness">fitness</option>
            <option value="personal">personal</option>
          </select>
          <select value={f.ruleType} onChange={set("ruleType")}>
            <option value="daily">daily</option>
            <option value="weekly">weekly (keeps its weekday)</option>
            <option value="interval">every N days (drifts with you)</option>
            <option value="monthly">monthly</option>
          </select>
          {f.ruleType === "weekly" && (
            <select value={f.day} onChange={set("day")}>
              {DOW.map((d) => <option key={d}>{d}</option>)}
            </select>
          )}
          {f.ruleType === "interval" && (
            <input className="num" type="number" min="2" value={f.everyN} onChange={set("everyN")} aria-label="Every N days" />
          )}
          {f.ruleType === "monthly" && (
            <input className="num" type="number" min="1" max="28" value={f.monthDay} onChange={set("monthDay")} aria-label="Day of month" />
          )}
        </div>
        <div className="form-row">
          <input type="time" value={f.anchor} onChange={set("anchor")} aria-label="Fixed time (optional)" />
          <input className="num" type="number" min="0" placeholder="min" value={f.minutes} onChange={set("minutes")} aria-label="Duration in minutes (optional)" />
          <select value={f.block} onChange={set("block")} disabled={!!f.anchor}>
            {BLOCKS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <button className="add" onClick={add}>Add goal</button>
        </div>
        <p className="hint">A fixed time pins the goal; otherwise it floats in a block. Weekly keeps its weekday even if done late; “every N days” counts from the last time you did it.</p>
      </div>
    </section>
  );
}
