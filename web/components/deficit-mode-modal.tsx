"use client";

import { useEffect } from "react";

import type { Mode } from "@/lib/mode-engine";
import { MODE_COPY } from "@/lib/mode-copy";

interface Props {
  mode: Mode | null;
  onClose: () => void;
}

/**
 * Per-mode info modal. Purely presentational — receives a mode, pulls copy
 * from MODE_COPY, and renders purpose + rules + citations. Closes on Escape
 * or background click.
 */
export function DeficitModeModal({ mode, onClose }: Props) {
  useEffect(() => {
    if (!mode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mode, onClose]);

  if (!mode) return null;

  const copy = MODE_COPY[mode];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deficit-mode-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface border border-border-glow rounded-2xl p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-text-muted">
              Deficit mode
            </p>
            <h2 id="deficit-mode-modal-title" className="text-lg font-semibold text-text mt-1">
              {copy.label}
            </h2>
            <p className="text-xs text-text-secondary mt-1">{copy.tagline}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg text-text-muted hover:text-text hover:bg-surface-elevated flex items-center justify-center text-lg"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-text leading-relaxed">{copy.description}</p>

        <div>
          <p className="text-[11px] font-semibold text-warm uppercase tracking-wider mb-2">
            Rules
          </p>
          <ul className="space-y-1.5">
            {copy.rules.map((rule) => (
              <li key={rule} className="text-sm text-text-secondary flex gap-2">
                <span className="text-teal mt-0.5">•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-warm uppercase tracking-wider mb-2">
            Research basis
          </p>
          <ul className="space-y-1">
            {copy.citations.map((cite) => (
              <li key={cite} className="text-xs text-text-muted">
                {cite}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
