"use client";

import { useEffect, useState } from "react";

export function StreakBadge() {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/nutrition/streak", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setStreak(typeof data.streak === "number" ? data.streak : 0);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, []);

  if (streak === null || streak < 2) return null;

  return (
    <span
      role="status"
      aria-label={`Streak ${streak} days`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warm/15 border border-warm/30 text-warm text-[10px] font-medium tracking-wide uppercase"
    >
      <span aria-hidden="true">🔥</span>
      <span>{streak} days</span>
    </span>
  );
}
