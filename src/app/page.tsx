"use client";

import { useSession } from "@/lib/useSession";
import SignIn from "@/components/SignIn";
import Dashboard from "@/components/Dashboard";

export default function Page() {
  const { status, email, isLocal } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }

  if (status === "signed-out") {
    return <SignIn />;
  }

  return <Dashboard isLocal={isLocal} email={email} />;
}
