"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ALL_METHODS,
  navyTapeFfmKg,
  type Method,
  type Sex,
} from "@/lib/body-comp";

interface AnchorRow {
  id: number;
  date: string;
  method: Method;
  ffm_kg: number;
  sigma_kg: number;
  effective_sigma_kg: number;
  notes: string | null;
}

interface GetResponse {
  current: AnchorRow;
  history: AnchorRow[];
}

interface Toast {
  tone: "success" | "error";
  text: string;
}

const METHOD_LABEL: Record<Method, string> = {
  dexa: "DEXA",
  caliper: "Caliper 3-site",
  navy: "Navy tape",
  bia: "BIA (e.g. Index S2)",
  nhanes: "NHANES estimate",
};

const SOFT_STALE_WEEKS = 8;
const HARD_STALE_WEEKS = 12;

function weeksSince(iso: string): number {
  const ms = Date.now() - new Date(iso + "T00:00:00Z").getTime();
  return ms / (7 * 24 * 60 * 60 * 1000);
}

/**
 * Settings section for logging body-composition anchors. Supports direct FFM
 * entry (DEXA/BIA/caliper) and Navy tape (neck/waist/height/weight → computed
 * FFM with a live preview). Includes a staleness banner when the current
 * anchor is past the 8-week reminder threshold.
 */
export function BodyCompEntry() {
  const [data, setData] = useState<GetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [method, setMethod] = useState<Method>("navy");
  const [ffmDirect, setFfmDirect] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // Navy tape inputs
  const [sex, setSex] = useState<Sex>("male");
  const [weightKg, setWeightKg] = useState<string>("");
  const [neckCm, setNeckCm] = useState<string>("");
  const [waistCm, setWaistCm] = useState<string>("");
  const [heightCm, setHeightCm] = useState<string>("");
  const [hipCm, setHipCm] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/nutrition/ffm-anchor", { cache: "no-store" });
      if (r.status === 404) {
        setData(null);
        return;
      }
      if (!r.ok) {
        setToast({ tone: "error", text: `Failed to load anchors (${r.status})` });
        return;
      }
      const body = (await r.json()) as GetResponse;
      setData(body);
    } catch {
      setToast({ tone: "error", text: "Failed to load anchors" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Live Navy tape preview. Returns null if inputs are incomplete or invalid.
  const navyPreview = useMemo(() => {
    if (method !== "navy") return null;
    const weight = Number(weightKg);
    const neck = Number(neckCm);
    const waist = Number(waistCm);
    const height = Number(heightCm);
    const hip = Number(hipCm);
    if (!weight || !neck || !waist || !height) return null;
    if (sex === "female" && !hip) return null;
    try {
      return navyTapeFfmKg({
        weightKg: weight,
        neckCm: neck,
        waistCm: waist,
        heightCm: height,
        sex,
        hipCm: sex === "female" ? hip : null,
      });
    } catch {
      return null;
    }
  }, [method, sex, weightKg, neckCm, waistCm, heightCm, hipCm]);

  const submit = useCallback(async () => {
    let ffm: number;
    if (method === "navy") {
      if (navyPreview == null) {
        setToast({ tone: "error", text: "Fill in all Navy tape inputs first" });
        return;
      }
      ffm = navyPreview;
    } else {
      ffm = Number(ffmDirect);
      if (!Number.isFinite(ffm) || ffm <= 0) {
        setToast({ tone: "error", text: "Enter a positive FFM value" });
        return;
      }
    }

    setLoading(true);
    try {
      const r = await fetch("/api/nutrition/ffm-anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          method,
          ffm_kg: Number(ffm.toFixed(2)),
          notes: notes || undefined,
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        setToast({ tone: "error", text: body.error ?? "Failed to log anchor" });
        return;
      }
      setToast({ tone: "success", text: `Logged ${METHOD_LABEL[method]} anchor` });
      setFfmDirect("");
      setNotes("");
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [method, navyPreview, ffmDirect, date, notes, refresh]);

  const staleBanner = useMemo(() => {
    if (!data?.current) return null;
    const weeks = weeksSince(data.current.date);
    if (weeks >= HARD_STALE_WEEKS) {
      return {
        tone: "strong" as const,
        text: `Your last body-comp measurement is ${Math.floor(weeks)} weeks old. CI widening is active — log a fresh one to tighten your FFM estimate.`,
      };
    }
    if (weeks >= SOFT_STALE_WEEKS) {
      return {
        tone: "soft" as const,
        text: `Your last body-comp measurement is ${Math.floor(weeks)} weeks old. Logging a fresh one keeps your estimate sharp.`,
      };
    }
    return null;
  }, [data]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-text mb-2">Body composition</h2>
      <p className="text-xs text-text-muted mb-3">
        Log FFM anchors from DEXA, calipers, Navy tape, BIA, or NHANES. The most
        recent anchor drives your current FFM estimate (no blending).
      </p>

      {staleBanner && (
        <div
          role="status"
          data-testid="body-comp-stale-banner"
          className={`mb-3 text-xs px-3 py-2 rounded-lg border ${
            staleBanner.tone === "strong"
              ? "bg-danger/10 border-danger/30 text-danger"
              : "bg-warm/10 border-warm/30 text-warm"
          }`}
        >
          {staleBanner.text}
        </div>
      )}

      {data?.current && (
        <div className="mb-4 rounded-lg border border-teal bg-teal-bg px-3 py-2">
          <p className="text-[10px] uppercase tracking-widest text-text-muted">Current anchor</p>
          <p className="text-sm text-text mt-1">
            {METHOD_LABEL[data.current.method]} · <span className="tnum">{data.current.ffm_kg.toFixed(1)} kg</span>
            <span className="text-text-muted">
              {" "}± {data.current.effective_sigma_kg.toFixed(1)} kg
            </span>
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">Logged {data.current.date}</p>
        </div>
      )}

      <div className="space-y-2 mb-4">
        <label className="block text-[11px] text-text-muted">
          Method
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as Method)}
            className="block mt-1 bg-surface-elevated border border-border-glow rounded-lg px-3 py-1.5 text-sm text-text"
          >
            {ALL_METHODS.filter((m) => m !== "nhanes").map((m) => (
              <option key={m} value={m}>{METHOD_LABEL[m]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2 mb-4">
        <label className="block text-[11px] text-text-muted">
          Measurement date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="block mt-1 bg-surface-elevated border border-border-glow rounded-lg px-3 py-1.5 text-sm text-text"
          />
        </label>
      </div>

      {method === "navy" ? (
        <div className="space-y-2 mb-4">
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-xs">
              <input type="radio" checked={sex === "male"} onChange={() => setSex("male")} /> Male
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="radio" checked={sex === "female"} onChange={() => setSex("female")} /> Female
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <InputCm label="Weight" unit="kg" value={weightKg} onChange={setWeightKg} />
            <InputCm label="Height" value={heightCm} onChange={setHeightCm} />
            <InputCm label="Neck" value={neckCm} onChange={setNeckCm} />
            <InputCm label="Waist" value={waistCm} onChange={setWaistCm} />
            {sex === "female" && (
              <InputCm label="Hip" value={hipCm} onChange={setHipCm} />
            )}
          </div>
          {navyPreview != null && (
            <p className="text-xs text-text-muted" data-testid="navy-preview">
              Estimated FFM: <span className="text-text tnum">{navyPreview.toFixed(1)} kg</span>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          <label className="block text-[11px] text-text-muted">
            FFM (kg)
            <input
              type="number"
              step="0.1"
              value={ffmDirect}
              onChange={(e) => setFfmDirect(e.target.value)}
              placeholder="e.g. 56.5"
              className="block mt-1 w-32 bg-surface-elevated border border-border-glow rounded-lg px-3 py-1.5 text-sm text-text"
            />
          </label>
        </div>
      )}

      <div className="mb-3">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full bg-surface-elevated border border-border-glow rounded-lg px-3 py-1.5 text-xs text-text"
        />
      </div>

      <button
        onClick={() => void submit()}
        disabled={loading}
        className="bg-teal text-base rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
      >
        {loading ? "Logging…" : "Log anchor"}
      </button>

      {toast && (
        <div
          role="status"
          className={`mt-3 text-xs px-3 py-2 rounded-lg border ${
            toast.tone === "success"
              ? "bg-success/10 border-success/30 text-success"
              : "bg-danger/10 border-danger/30 text-danger"
          }`}
        >
          {toast.text}
        </div>
      )}

      {data?.history && data.history.length > 1 && (
        <div className="mt-5">
          <p className="text-[11px] font-semibold text-warm uppercase tracking-wider mb-1">
            History
          </p>
          <div className="space-y-1">
            {data.history.slice(1).map((a) => (
              <div key={a.id} className="flex items-center text-xs text-text-muted">
                <span className="w-24 tnum">{a.date}</span>
                <span className="w-36">{METHOD_LABEL[a.method]}</span>
                <span className="tnum">{a.ffm_kg.toFixed(1)} ± {a.effective_sigma_kg.toFixed(1)} kg</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InputCm({
  label, value, onChange, unit = "cm",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
}) {
  return (
    <label className="block text-[11px] text-text-muted mb-0.5">
      {label} ({unit})
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block mt-1 w-full bg-surface-elevated border border-border-glow rounded-lg px-3 py-1.5 text-sm text-text"
      />
    </label>
  );
}
