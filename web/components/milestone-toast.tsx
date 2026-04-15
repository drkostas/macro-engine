"use client";

import { useEffect, useState } from "react";

interface MilestoneInfo {
  id: string;
  label: string;
}

/**
 * Fetches /api/nutrition/milestones on mount. For each newly-achieved
 * milestone, shows a dismissible celebration toast. Cycles through them
 * one at a time so multiple achievements don't stack visually.
 */
export function MilestoneToast() {
  const [queue, setQueue] = useState<MilestoneInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/nutrition/milestones", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const newIds: string[] = Array.isArray(data.newlyAchieved) ? data.newlyAchieved : [];
        const byId = new Map<string, MilestoneInfo>(
          (data.all ?? []).map((m: MilestoneInfo) => [m.id, m]),
        );
        const nextQ = newIds
          .map((id) => byId.get(id))
          .filter((m): m is MilestoneInfo => !!m);
        if (nextQ.length > 0) setQueue(nextQ);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (queue.length === 0) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 6000);
    return () => clearTimeout(t);
  }, [queue]);

  if (queue.length === 0) return null;
  const current = queue[0];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Milestone achieved: ${current.label}`}
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[90] bg-surface-elevated border-2 border-warm/50 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3 max-w-[90vw]"
    >
      <span aria-hidden="true" className="text-2xl">🏆</span>
      <div className="flex flex-col">
        <span className="t-caption text-warm font-semibold uppercase tracking-wider">
          Achievement unlocked
        </span>
        <span className="t-body text-text">{current.label}</span>
      </div>
      <button
        onClick={() => setQueue((q) => q.slice(1))}
        aria-label="Dismiss achievement"
        className="t-caption text-text-faint hover:text-text-secondary w-6 h-6 flex items-center justify-center ml-2"
      >
        ×
      </button>
    </div>
  );
}
