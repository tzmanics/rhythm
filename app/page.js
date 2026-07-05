"use client";
import { useState, useEffect } from "react";
import { getSupabase } from "../lib/supabase";
import Auth from "../components/Auth";
import Rhythm from "../components/Rhythm";

export default function Page() {
  const [session, setSession] = useState(undefined); // undefined = checking

  useEffect(() => {
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined)
    return (
      <div className="rhythm">
        <div className="loading">…</div>
      </div>
    );
  if (!session) return <Auth />;
  return <Rhythm onSignOut={() => getSupabase().auth.signOut()} />;
}
