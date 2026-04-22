"use client";

import { useCallback, useState } from "react";
import type { TaperPhase } from "@/lib/taper";

export interface TaperContext {
  raceDate: string;
  daysUntil: number;
  phase: TaperPhase;
  carbGPerKg: number;
  proteinGPerKg: number;
}

interface Props {
  taper: TaperContext | null;
  onChange: () => void;
}

const PHASE_LABEL: Record<TaperPhase, string> = {
  normal: "Normal training",
  volume_taper: "Volume taper",
  intensity_taper: "Intensity taper",
  glycogen_loading: "Glycogen loading",
  race_day: "Race day",
  recovery: "Recovery",
};

const PHASE_TONE: Record<TaperPhase, string> = {
  normal: "text-text-secondary",
  volume_taper: "text-teal",
  intensity_taper: "text-teal",
  glycogen_loading: "text-warm",
  race_day: "text-warning",
  recovery: "text-text-secondary",
};

export function TaperCard({ taper, onChange }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [formDate, setFormDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [saving, setSaving] = useState(false);

  const submit = useCallback(
    async (date: string | null) => {
      setSaving(true);
      try {
        await fetch("/api/nutrition/taper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ race_date: date }),
        });
        setFormOpen(false);
        onChange();
      } finally {
        setSaving(false);
      }
    },
    [onChange],
  );

  if (!taper) {
    return (
      <div
        data-testid="taper-card"
        className="border border-border-glow rounded-lg bg-surface-elevated p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-text">Race taper</p>
            <p className="text-[11px] text-text-muted">No upcoming race</p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen((x) => !x)}
            className="text-[11px] font-semibold bg-teal text-base rounded-lg px-3 py-1"
          >
            {formOpen ? "Cancel" : "Set race"}
          </button>
        </div>
        {formOpen && (
          <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
            <label className="block">
              <span className="text-[11px] text-text-secondary">Race date</span>
              <input
                type="date"
                value={formDate}
                aria-label="Race date"
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-0.5 w-full bg-surface-hover border border-border-subtle rounded px-2 py-1 text-xs text-text"
              />
            </label>
            <button
              type="button"
              onClick={() => void submit(formDate)}
              disabled={saving}
              className="bg-teal text-base rounded-lg px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save race date"}
            </button>
          </div>
        )}
      </div>
    );
  }

  const daysText =
    taper.daysUntil > 0
      ? `${taper.daysUntil} day${taper.daysUntil === 1 ? "" : "s"} to go`
      : taper.daysUntil === 0
      ? "Today"
      : `${Math.abs(taper.daysUntil)} day${taper.daysUntil === -1 ? "" : "s"} post-race`;

  return (
    <div
      data-testid="taper-card"
      className="border border-border-glow rounded-lg bg-surface-elevated p-3 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text">
            Race taper ·{" "}
            <span className={PHASE_TONE[taper.phase]}>{PHASE_LABEL[taper.phase]}</span>
          </p>
          <p className="text-[11px] text-text-muted">
            {taper.raceDate} · {daysText}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void submit(null)}
          disabled={saving}
          className="text-[11px] font-semibold bg-surface-hover border border-border-subtle text-text rounded-lg px-3 py-1 disabled:opacity-50"
        >
          Clear race
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Carbs</div>
          <div className="text-sm font-semibold text-text tnum">
            {taper.carbGPerKg.toFixed(1)}{" "}
            <span className="text-[10px] text-text-muted">g/kg</span>
          </div>
        </div>
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Protein</div>
          <div className="text-sm font-semibold text-text tnum">
            {taper.proteinGPerKg.toFixed(1)}{" "}
            <span className="text-[10px] text-text-muted">g/kg</span>
          </div>
        </div>
      </div>
    </div>
  );
}
