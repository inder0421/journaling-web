"use client";

export default function Header({
  isLocal,
  email,
  onOpenRules,
  onSignOut,
}: {
  isLocal: boolean;
  email: string | null;
  onOpenRules: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-base font-semibold tracking-tight">
          Discipline Journal
        </h1>
        <div className="flex items-center gap-1.5 text-xs text-faint">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isLocal ? "bg-warn" : "bg-win"
            }`}
          />
          {isLocal ? "Local only" : email ? `Synced · ${email}` : "Synced"}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onOpenRules}
          aria-label="Risk rules"
          className="rounded-md border border-line bg-surface p-2 text-muted hover:text-fg"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M12 2v3.2M12 18.8V22M22 12h-3.2M5.2 12H2M19.07 4.93l-2.26 2.26M7.19 16.81l-2.26 2.26M19.07 19.07l-2.26-2.26M7.19 7.19 4.93 4.93"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {!isLocal && (
          <button
            onClick={onSignOut}
            aria-label="Sign out"
            className="rounded-md border border-line bg-surface p-2 text-muted hover:text-fg"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 17l5-5-5-5M20 12H9M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
