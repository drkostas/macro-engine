"use client";

import type { InjuryNutritionModule } from "@/lib/injured";

interface Props {
  module: InjuryNutritionModule;
}

export function InjuryModuleChecklist({ module }: Props) {
  if (module.supplements.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-faint">
          Supplements
        </span>
        <span
          data-testid="injury-rationale"
          title={module.rationale}
          aria-label={module.rationale}
          className="text-[10px] text-text-muted cursor-help"
        >
          ⓘ
        </span>
      </div>
      <ul className="flex flex-wrap gap-1">
        {module.supplements.map((s) => (
          <li
            key={s}
            className="text-[11px] bg-surface-hover border border-border-subtle rounded px-2 py-0.5 text-text-secondary"
          >
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
