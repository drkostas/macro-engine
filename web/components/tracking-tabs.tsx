"use client";

import { useState } from "react";
import { WeeklyWrapupCard } from "./weekly-wrapup-card";
import { ProgressionCard } from "./progression-card";
import { YearReviewCard } from "./year-review-card";

type TabKey = "week" | "progress" | "year";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "week", label: "Week" },
  { key: "progress", label: "Progress" },
  { key: "year", label: "Year" },
];

export function TrackingTabs() {
  const [active, setActive] = useState<TabKey>("week");

  return (
    <div data-testid="tracking-tabs" className="space-y-2">
      <div className="flex gap-1">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              data-active={isActive ? "true" : "false"}
              className={`flex-1 text-[11px] font-semibold rounded px-2 py-1 border transition-colors ${
                isActive
                  ? "bg-teal-bg text-teal border-teal"
                  : "bg-surface-hover text-text-muted border-border-subtle hover:text-text"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div>
        {active === "week" && <WeeklyWrapupCard />}
        {active === "progress" && <ProgressionCard />}
        {active === "year" && <YearReviewCard />}
      </div>
    </div>
  );
}
