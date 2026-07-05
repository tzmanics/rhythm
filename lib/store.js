import { getSupabase } from "./supabase";
import { SEEDS } from "./rhythm";

/* ============================================================
   Storage adapter — the ONLY file that talks to the database.
   Goals live as jsonb documents; completions are an append-only
   log. Swap this file to change backends; nothing else knows.
   ============================================================ */

const rowToGoal = (row) => ({ ...row.data, id: row.id });
const rowToCompletion = (row) => ({
  goalId: row.goal_id,
  date: row.date,
  value: row.value ? Number(row.value) : undefined,
});

/** Load everything. Seeds the household defaults on first login. */
export async function loadAll() {
  const sb = getSupabase();
  let { data: goalRows, error } = await sb.from("goals").select("id, data");
  if (error) throw error;

  if (goalRows.length === 0) {
    const { data: seeded, error: seedErr } = await sb
      .from("goals")
      .insert(SEEDS().map((data) => ({ data })))
      .select("id, data");
    if (seedErr) throw seedErr;
    goalRows = seeded;
  }

  const { data: compRows, error: compErr } = await sb
    .from("completions")
    .select("goal_id, date, value");
  if (compErr) throw compErr;

  return {
    goals: goalRows.map(rowToGoal),
    completions: compRows.map(rowToCompletion),
  };
}

export async function addGoal(goalData) {
  const { data, error } = await getSupabase()
    .from("goals")
    .insert({ data: goalData })
    .select("id, data")
    .single();
  if (error) throw error;
  return rowToGoal(data);
}

export async function updateGoal(goal) {
  const { id, ...data } = goal;
  const { error } = await getSupabase().from("goals").update({ data }).eq("id", id);
  if (error) throw error;
}

export async function deleteGoal(id) {
  const { error } = await getSupabase().from("goals").delete().eq("id", id);
  if (error) throw error;
}

export async function addCompletion({ goalId, date, value }) {
  const { error } = await getSupabase()
    .from("completions")
    .insert({ goal_id: goalId, date, value: value ?? null });
  if (error) throw error;
}

export async function deleteCompletion(goalId, date) {
  const { error } = await getSupabase()
    .from("completions")
    .delete()
    .eq("goal_id", goalId)
    .eq("date", date);
  if (error) throw error;
}
