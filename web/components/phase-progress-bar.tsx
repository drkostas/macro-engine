"use client";

import type { InjuryPhase } from "@/lib/injured";

interface Props {
  phase: InjuryPhase;
  daysSinceInjury: number;
}

const SEGMENTS: Array<{ key: InjuryPhase; label: string; range: string }> = [
  { key: "acute", label: "Acute", range: "0–10d" },
  { key: "subacute", label: "Subacute", range: "11–42d" },
  { key: "chronic", label: "Chronic", range: "42d+" },
];

export function PhaseProgressBar({ phase, daysSinceInjury }: Props) {
  return (
    <div data-testid="phase-progress-bar" className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-text-faint">
          Recovery phase
        </span>
        <span className="text-[11px] tnum text-text-secondary">
          Day {daysSinceInjury}
        </span>
      </div>
      <div className="flex gap-1">
        {SEGMENTS.map((s) => {
          const active = s.key === phase;
          return (
            <div
              key={s.key}
              data-testid={`phase-segment-${s.key}`}
              data-active={active ? "true" : "false"}
              className={`flex-1 rounded px-2 py-1 text-center transition-colors ${
                active
                  ? "bg-teal-bg text-teal border border-teal"
                  : "bg-surface-hover text-text-muted border border-border-subtle"
              }`}
            >
              <div className="text-[10px] font-semibold leading-tight">{s.label}</div>
              <div className="text-[9px] leading-tight">{s.range}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
