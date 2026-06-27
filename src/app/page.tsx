"use client";

import Dashboard from "@/components/Dashboard";
import { isSupabaseConfigured } from "@/lib/supabase";

// No sign-in: the app opens straight to the dashboard. When Supabase is
// configured, data is shared across all devices (single shared owner).
export default function Page() {
  return <Dashboard isLocal={!isSupabaseConfigured} email={null} />;
}
