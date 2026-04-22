"use client";

import { useCallback, useState } from "react";
import type { InjuryPhase, InjuryType, InjuryNutritionModule } from "@/lib/injured";
import { ALL_INJURY_TYPES } from "@/lib/injured";
import { PhaseProgressBar } from "./phase-progress-bar";
import { InjuryModuleChecklist } from "./injury-module-checklist";

export interface ActiveInjury {
  active: true;
  id: number;
  injuryDate: string;
  type: InjuryType;
  phase: InjuryPhase;
  proteinGPerKg: number;
  eaFloorKcal: number;
  module: InjuryNutritionModule;
}

interface Props {
  injury: ActiveInjury | null;
  onChange: () => void;
}

function daysSince(iso: string): number {
  const start = new Date(iso + "T00:00:00Z").getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - start) / 86400000));
}

export function InjuryCard({ injury, onChange }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formType, setFormType] = useState<InjuryType>("default");
  const [formDate, setFormDate] = useState(() =>
    new Date().toISOString().split("T")[0],
  );
  const [formRehab, setFormRehab] = useState(0);
  const [formPreProtein, setFormPreProtein] = useState(2.0);

  const submit = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/nutrition/injury", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          injury_date: formDate,
          type: formType,
          rehab_kcal: formRehab,
          pre_injury_protein_g_per_kg: formPreProtein,
        }),
      });
      setFormOpen(false);
      onChange();
    } finally {
      setSaving(false);
    }
  }, [formDate, formType, formRehab, formPreProtein, onChange]);

  const markRecovered = useCallback(async () => {
    if (!injury) return;
    setSaving(true);
    try {
      await fetch("/api/nutrition/injury", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: injury.id }),
      });
      onChange();
    } finally {
      setSaving(false);
    }
  }, [injury, onChange]);

  if (!injury) {
    return (
      <div
        data-testid="injury-card"
        className="border border-border-glow rounded-lg bg-surface-elevated p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-text">Injury tracker</p>
            <p className="text-[11px] text-text-muted">No active injury</p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen((x) => !x)}
            className="text-[11px] font-semibold bg-teal text-base rounded-lg px-3 py-1"
          >
            {formOpen ? "Cancel" : "Log injury"}
          </button>
        </div>
        {formOpen && (
          <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
            <label className="block">
              <span className="text-[11px] text-text-secondary">Injury type</span>
              <select
                value={formType}
                aria-label="Injury type"
                onChange={(e) => setFormType(e.target.value as InjuryType)}
                className="mt-0.5 w-full bg-surface-hover border border-border-subtle rounded px-2 py-1 text-xs text-text"
              >
                {ALL_INJURY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-text-secondary">Date</span>
              <input
                type="date"
                value={formDate}
                aria-label="Injury date"
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-0.5 w-full bg-surface-hover border border-border-subtle rounded px-2 py-1 text-xs text-text"
              />
            </label>
            <label className="block">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] text-text-secondary">Rehab kcal / day</span>
                <span className="text-xs tnum text-text">{formRehab}</span>
              </div>
              <input
                type="range"
                min={0}
                max={800}
                step={50}
                value={formRehab}
                aria-label="Rehab kcal"
                onChange={(e) => setFormRehab(Number(e.target.value))}
                className="w-full accent-teal"
              />
            </label>
            <label className="block">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] text-text-secondary">Pre-injury protein g/kg</span>
                <span className="text-xs tnum text-text">{formPreProtein.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={1.0}
                max={3.0}
                step={0.1}
                value={formPreProtein}
                aria-label="Pre-injury protein"
                onChange={(e) => setFormPreProtein(Number(e.target.value))}
                className="w-full accent-teal"
              />
            </label>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className="bg-teal text-base rounded-lg px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {saving ? "Logging…" : "Save injury"}
            </button>
          </div>
        )}
      </div>
    );
  }

  const days = daysSince(injury.injuryDate);
  return (
    <div
      data-testid="injury-card"
      className="border border-border-glow rounded-lg bg-surface-elevated p-3 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text">
            Active injury · <span className="text-teal uppercase">{injury.type}</span>
          </p>
          <p className="text-[11px] text-text-muted">
            Since {injury.injuryDate} · <span className="capitalize">{injury.phase}</span> phase
          </p>
        </div>
        <button
          type="button"
          onClick={() => void markRecovered()}
          disabled={saving}
          className="text-[11px] font-semibold bg-surface-hover border border-border-subtle text-text rounded-lg px-3 py-1 disabled:opacity-50"
        >
          Mark recovered
        </button>
      </div>
      <PhaseProgressBar phase={injury.phase} daysSinceInjury={days} />
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Protein</div>
          <div className="text-sm font-semibold text-text tnum">
            {injury.proteinGPerKg.toFixed(1)} <span className="text-[10px] text-text-muted">g/kg</span>
          </div>
        </div>
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">EA floor</div>
          <div className="text-sm font-semibold text-text tnum">
            {injury.eaFloorKcal} <span className="text-[10px] text-text-muted">kcal</span>
          </div>
        </div>
      </div>
      <div data-testid="injury-module-checklist">
        <p className="text-[11px] text-text-secondary mb-1">{injury.module.label}</p>
        <InjuryModuleChecklist module={injury.module} />
      </div>
    </div>
  );
}
