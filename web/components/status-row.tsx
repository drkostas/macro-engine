"use client";

import { useCallback, useState } from "react";
import type { ActiveInjury } from "./injury-card";
import type { TaperContext } from "./taper-card";
import type { ClimateContext } from "./climate-card";

export type StatusKey = "injury" | "taper" | "climate";

interface Props {
  injury: ActiveInjury | null;
  taper: TaperContext | null;
  climate: ClimateContext | null;
  expanded: StatusKey | null;
  onToggleExpanded: (key: StatusKey) => void;
  onRefresh: () => void;
}

function isClimateActive(c: ClimateContext | null): boolean {
  return c !== null && c.env !== "normal";
}

function formatDaysUntil(n: number): string {
  if (n === 0) return "today";
  if (n > 0) return `${n}d to go`;
  return `${Math.abs(n)}d post`;
}

export function StatusRow({
  injury, taper, climate, expanded, onToggleExpanded, onRefresh,
}: Props) {
  const [setupOpen, setSetupOpen] = useState(false);

  const injuryActive = injury !== null;
  const taperActive = taper !== null;
  const climateActive = isClimateActive(climate);

  const anyActive = injuryActive || taperActive || climateActive;
  const anyInactive = !injuryActive || !taperActive || !climateActive;

  const setClimate = useCallback(async (env: "altitude" | "heat" | "cold") => {
    await fetch("/api/nutrition/climate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ env }),
    });
    setSetupOpen(false);
    onRefresh();
  }, [onRefresh]);

  if (!anyActive) return null;

  return (
    <div
      data-testid="status-row"
      className="border border-border-glow rounded-lg bg-surface-elevated p-2 flex items-center gap-1 flex-wrap"
    >
      {injuryActive && injury && (
        <button
          type="button"
          data-testid="status-pill-injury"
          data-expanded={expanded === "injury" ? "true" : "false"}
          onClick={() => onToggleExpanded("injury")}
          className={`text-[11px] font-semibold rounded-full px-3 py-1 border transition-colors ${
            expanded === "injury"
              ? "bg-teal-bg text-teal border-teal"
              : "bg-surface-hover text-text border-border-subtle hover:text-teal"
          }`}
        >
          <span className="text-text-muted mr-1">Injury</span>
          <span className="uppercase">{injury.type}</span>
          <span className="text-text-muted mx-1">·</span>
          <span className="capitalize">{injury.phase}</span>
        </button>
      )}
      {taperActive && taper && (
        <button
          type="button"
          data-testid="status-pill-taper"
          data-expanded={expanded === "taper" ? "true" : "false"}
          onClick={() => onToggleExpanded("taper")}
          className={`text-[11px] font-semibold rounded-full px-3 py-1 border transition-colors ${
            expanded === "taper"
              ? "bg-teal-bg text-teal border-teal"
              : "bg-surface-hover text-text border-border-subtle hover:text-teal"
          }`}
        >
          <span className="text-text-muted mr-1">Race</span>
          <span className="capitalize">{taper.phase.replace(/_/g, " ")}</span>
          <span className="text-text-muted mx-1">·</span>
          {formatDaysUntil(taper.daysUntil)}
        </button>
      )}
      {climateActive && climate && (
        <button
          type="button"
          data-testid="status-pill-climate"
          data-expanded={expanded === "climate" ? "true" : "false"}
          onClick={() => onToggleExpanded("climate")}
          className={`text-[11px] font-semibold rounded-full px-3 py-1 border transition-colors ${
            expanded === "climate"
              ? "bg-teal-bg text-teal border-teal"
              : "bg-surface-hover text-text border-border-subtle hover:text-teal"
          }`}
        >
          <span className="text-text-muted mr-1">Climate</span>
          <span className="capitalize">{climate.env}</span>
        </button>
      )}
      {anyInactive && (
        <div className="relative ml-auto">
          <button
            type="button"
            data-testid="status-setup-button"
            aria-label="Add status"
            onClick={() => setSetupOpen((x) => !x)}
            className="text-[12px] rounded-full w-6 h-6 bg-surface-hover border border-border-subtle text-text-muted hover:text-teal flex items-center justify-center"
          >
            ⚙
          </button>
          {setupOpen && (
            <div className="absolute right-0 mt-1 z-10 bg-surface-elevated border border-border-glow rounded-lg p-2 flex flex-col gap-1 min-w-[160px] shadow-lg">
              {!injuryActive && (
                <button
                  type="button"
                  onClick={() => { setSetupOpen(false); onToggleExpanded("injury"); }}
                  className="text-[11px] text-text-secondary hover:text-teal text-left px-2 py-1 rounded hover:bg-surface-hover"
                >
                  + Log injury
                </button>
              )}
              {!taperActive && (
                <button
                  type="button"
                  onClick={() => { setSetupOpen(false); onToggleExpanded("taper"); }}
                  className="text-[11px] text-text-secondary hover:text-teal text-left px-2 py-1 rounded hover:bg-surface-hover"
                >
                  + Set race
                </button>
              )}
              {!climateActive && (
                <>
                  <span className="text-[10px] text-text-faint uppercase tracking-wider px-2">Climate</span>
                  <button
                    type="button"
                    onClick={() => void setClimate("altitude")}
                    className="text-[11px] text-text-secondary hover:text-teal text-left px-2 py-1 rounded hover:bg-surface-hover"
                  >
                    Altitude
                  </button>
                  <button
                    type="button"
                    onClick={() => void setClimate("heat")}
                    className="text-[11px] text-text-secondary hover:text-teal text-left px-2 py-1 rounded hover:bg-surface-hover"
                  >
                    Heat
                  </button>
                  <button
                    type="button"
                    onClick={() => void setClimate("cold")}
                    className="text-[11px] text-text-secondary hover:text-teal text-left px-2 py-1 rounded hover:bg-surface-hover"
                  >
                    Cold
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
