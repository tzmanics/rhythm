import { createClient } from "@supabase/supabase-js";

let client = null;

/** Lazy singleton — created on first use in the browser. */
export function getSupabase() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return client;
}
