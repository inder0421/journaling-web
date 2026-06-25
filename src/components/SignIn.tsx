"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Stage = "email" | "code";

export default function SignIn() {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const sb = getSupabase()!;
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          // Same-device link clicks land back on the app and sign in
          // automatically (handled by detectSessionInUrl).
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
      setStage("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const sb = getSupabase()!;
      const { error } = await sb.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      // onAuthStateChange in useSession takes over from here.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-tight">
          Discipline Journal
        </h1>
        <p className="mt-1 text-sm text-muted">
          Sign in with your email to sync across devices. We send a one-time
          code — no password.
        </p>
      </div>

      {stage === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Email
            </span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-line bg-surface px-3 py-3 text-base text-fg placeholder:text-faint focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="w-full rounded-md bg-accent px-3 py-3 text-base font-medium text-white disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-muted">
            Enter the 6-digit code sent to{" "}
            <span className="text-fg">{email}</span> — or just open the link in
            that email on this device.
          </p>
          <input
            type="text"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            maxLength={8}
            className="w-full rounded-md border border-line bg-surface px-3 py-3 text-center text-2xl tracking-[0.4em] text-fg placeholder:text-faint focus:border-accent tnum"
          />
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="w-full rounded-md bg-accent px-3 py-3 text-base font-medium text-white disabled:opacity-40"
          >
            {busy ? "Verifying…" : "Verify & sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStage("email");
              setCode("");
              setError(null);
            }}
            className="w-full py-2 text-sm text-muted hover:text-fg"
          >
            Use a different email
          </button>
        </form>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
