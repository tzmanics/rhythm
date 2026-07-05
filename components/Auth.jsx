"use client";
import { useState } from "react";
import { getSupabase } from "../lib/supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // null | 'sending' | 'sent' | error string

  const redirectTo =
    typeof window !== "undefined" ? window.location.origin : undefined;

  const sendLink = async () => {
    if (!email.trim() || status === "sending") return;
    setStatus("sending");
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setStatus(error ? error.message : "sent");
  };

  const oauth = (provider) =>
    getSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

  return (
    <div className="rhythm auth-page">
      <div className="auth-card">
        <div className="mast-title">
          <span className="mast-dot" />
          Rhythm
        </div>
        <h1 className="auth-h1">Your day, kept.</h1>
        <p className="auth-sub">Sign in to open your schedule.</p>

        <button className="oauth-btn" onClick={() => oauth("google")}>
          Continue with Google
        </button>
        <button className="oauth-btn" onClick={() => oauth("github")}>
          Continue with GitHub
        </button>

        <div className="auth-or">or</div>

        {status === "sent" ? (
          <p className="auth-sent">
            Check your email — your sign-in link is on its way.
          </p>
        ) : (
          <div className="auth-email-row">
            <input
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
              aria-label="Email address"
            />
            <button onClick={sendLink} disabled={status === "sending"}>
              {status === "sending" ? "…" : "Email me a link"}
            </button>
          </div>
        )}
        {status && status !== "sent" && status !== "sending" && (
          <p className="auth-error">{status}</p>
        )}
      </div>
    </div>
  );
}
