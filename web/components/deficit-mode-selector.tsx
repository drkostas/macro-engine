"use client";

import { useCallback, useEffect, useState } from "react";

import { ALL_MODES, type Mode, type ModeConfig, type TransitionReason } from "@/lib/mode-engine";
import { MODE_COPY, transitionReasonCopy } from "@/lib/mode-copy";
import { DeficitModeModal } from "./deficit-mode-modal";

interface TransitionInfo {
  allowed: boolean;
  reason: TransitionReason | null;
  requiresBridge: Mode | null;
}

interface ModeResponse {
  current: Mode;
  config: ModeConfig;
  availableTransitions: Record<string, TransitionInfo>;
}

interface ToastState {
  tone: "success" | "error";
  text: string;
}

/**
 * Settings section that drives /api/nutrition/mode. Renders every mode as a
 * row; the current mode is highlighted, blocked modes show a muted state with
 * an inline reason, and an info button on each row opens the per-mode modal.
 */
export function DeficitModeSelector() {
  const [data, setData] = useState<ModeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [infoMode, setInfoMode] = useState<Mode | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/nutrition/mode", { cache: "no-store" });
      if (!r.ok) {
        setToast({ tone: "error", text: `Failed to load modes (${r.status})` });
        return;
      }
      const body = (await r.json()) as ModeResponse;
      setData(body);
    } catch {
      setToast({ tone: "error", text: "Failed to load modes" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto-dismiss toasts after a short delay so they don't linger.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const switchMode = useCallback(
    async (mode: Mode) => {
      setLoading(true);
      try {
        const r = await fetch("/api/nutrition/mode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const body = await r.json();
        if (!r.ok) {
          const reason = body.reason as TransitionReason | undefined;
          setToast({
            tone: "error",
            text: reason ? transitionReasonCopy(reason) : body.error ?? "Switch failed",
          });
          return;
        }
        setToast({ tone: "success", text: `Switched to ${MODE_COPY[mode].label}` });
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  if (!data) {
    return (
      <p className="text-sm text-text-muted">Loading deficit modes…</p>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-text mb-2">Deficit mode</h2>
      <p className="text-xs text-text-muted mb-3">
        Your current cutting / maintenance / bulking context. Some modes are
        gated by your BF% tier — tap any row to read why.
      </p>

      <div className="space-y-1.5">
        {ALL_MODES.map((mode) => {
          const isCurrent = mode === data.current;
          const transition = data.availableTransitions[mode];
          const allowed = isCurrent || (transition?.allowed ?? false);
          const inlineReason =
            !isCurrent && transition && !transition.allowed && transition.reason
              ? transitionReasonCopy(transition.reason)
              : null;
          const copy = MODE_COPY[mode];

          return (
            <div
              key={mode}
              data-testid={`deficit-mode-row-${mode}`}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 min-h-[48px] transition-colors ${
                isCurrent
                  ? "bg-teal-bg border border-teal"
                  : allowed
                    ? "bg-surface-elevated border border-border-subtle hover:bg-surface-hover"
                    : "bg-surface-elevated/50 border border-border-subtle"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? "bg-teal" : "bg-text-faint"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${allowed ? "text-text" : "text-text-muted"}`}>
                    {copy.label}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold text-teal uppercase tracking-wider">
                      current
                    </span>
                  )}
                </div>
                {inlineReason ? (
                  <p className="text-[11px] text-warm-dim mt-0.5">{inlineReason}</p>
                ) : (
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">{copy.tagline}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInfoMode(mode)}
                aria-label={`About ${copy.label}`}
                className="w-7 h-7 shrink-0 rounded-md text-text-muted hover:text-text hover:bg-surface-hover flex items-center justify-center text-xs"
              >
                i
              </button>
              <button
                type="button"
                disabled={loading || isCurrent || !allowed}
                onClick={() => void switchMode(mode)}
                className={`text-[11px] font-semibold px-3 py-1 rounded border transition-colors ${
                  isCurrent
                    ? "bg-teal text-base border-teal cursor-default"
                    : allowed
                      ? "bg-transparent text-teal border-teal hover:bg-teal-bg disabled:opacity-50"
                      : "bg-transparent text-text-faint border-border-subtle cursor-not-allowed"
                }`}
              >
                {isCurrent ? "Active" : allowed ? "Switch" : "Blocked"}
              </button>
            </div>
          );
        })}
      </div>

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

      <DeficitModeModal mode={infoMode} onClose={() => setInfoMode(null)} />
    </div>
  );
}
