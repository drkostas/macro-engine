"use client";

import { useEffect, useState } from "react";

import type { HooperAlert } from "@/lib/subjective";

/**
 * Top-of-hero banner when the 28-day Hooper Z-alert is elevated/high.
 * Fetches once on mount; re-fetch happens when user saves a check-in (by
 * re-mounting via key change from the parent).
 */
export function WellnessBanner() {
  const [alert, setAlert] = useState<HooperAlert | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await fetch("/api/nutrition/subjective", {
          cache: "no-store", signal: ctrl.signal,
        });
        if (!r.ok) return;
        const body = await r.json();
        setAlert(body.alert as HooperAlert);
      } catch {
        // ignore aborts
      }
    })();
    return () => ctrl.abort();
  }, []);

  if (!alert || alert.alertLevel === "normal") return null;

  const tone = alert.alertLevel === "high"
    ? "bg-danger/15 border-danger/40 text-danger"
    : "bg-warm/10 border-warm/30 text-warm";

  const z = alert.zScore.toFixed(1);
  const severity = alert.alertLevel === "high" ? "High" : "Elevated";

  return (
    <div
      role="status"
      data-testid="wellness-banner"
      className={`flex items-start gap-3 border rounded-lg px-3 py-2 text-xs ${tone}`}
    >
      <div className="flex-1">
        <p className="font-semibold leading-tight">{severity} fatigue signal</p>
        <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
          Hooper Z-score {z} vs 28-day baseline. A refeed or rest day is
          usually the fastest reset.
        </p>
      </div>
    </div>
  );
}
