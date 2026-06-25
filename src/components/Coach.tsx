"use client";

import { Insight, InsightTone } from "@/lib/coach";

const dotTone: Record<InsightTone, string> = {
  good: "bg-win",
  warn: "bg-warn",
  bad: "bg-danger",
  info: "bg-faint",
};

export default function Coach({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h2 className="text-sm font-semibold">Coach</h2>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-faint">
          from your data
        </span>
      </div>
      <ul className="space-y-2.5">
        {insights.map((ins, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-snug text-fg/90">
            <span
              className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${dotTone[ins.tone]}`}
              aria-hidden
            />
            <span>{ins.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
