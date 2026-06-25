"use client";

import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export type AuthStatus = "loading" | "signed-in" | "signed-out" | "local";

/** Tracks Supabase auth. In local-only mode, status is always "local". */
export function useSession() {
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? "loading" : "local"
  );
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase()!;

    sb.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "signed-in" : "signed-out");
      setEmail(data.session?.user.email ?? null);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? "signed-in" : "signed-out");
      setEmail(session?.user.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { status, email, isLocal: !isSupabaseConfigured };
}

export async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}
