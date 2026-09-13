"use client";

import { useEffect, useRef, useState } from "react";

interface WeighInWidgetProps {
  currentWeight: number;
  onSaved: (newWeight: number) => void;
}

export function WeighInWidget({ currentWeight, onSaved }: WeighInWidgetProps) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(currentWeight);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.select();
  }, [open]);

  // Keep val in sync when the prop updates (e.g. refetch after save): state adjusted during
  // render (React's derived-state pattern) instead of a setState inside an effect.
  const [syncedFrom, setSyncedFrom] = useState(currentWeight);
  if (currentWeight !== syncedFrom) {
    setSyncedFrom(currentWeight);
    setVal(currentWeight);
  }

  const save = async () => {
    setError(null);
    if (val < 20 || val > 400) {
      setError("20-400 kg");
      return;
    }
    setSaving(true);
    try {
      const resp = await fetch("/api/nutrition/weigh-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight_kg: val }),
      });
      if (!resp.ok) {
        setError("Save failed");
        return;
      }
      onSaved(val);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setVal(currentWeight);
    setError(null);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setVal(currentWeight); setOpen(true); }}
        className="t-caption text-text-muted hover:text-warm transition-colors tnum inline-flex items-center gap-1"
        aria-label="Update weight"
      >
        {currentWeight.toFixed(1)} kg
        <span className="opacity-60">✎</span>
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 bg-surface-elevated rounded-lg px-2 py-1 border border-border-glow">
      <input
        ref={inputRef}
        type="number"
        step="0.1"
        min="20"
        max="400"
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
        className="w-16 bg-transparent t-body text-text text-right focus:outline-none tnum"
      />
      <span className="t-caption text-text-muted">kg</span>
      <button
        onClick={save}
        disabled={saving}
        className="t-caption bg-warm hover:bg-warm-light text-white px-2 py-0.5 rounded-md disabled:opacity-50"
      >
        {saving ? "..." : "Save"}
      </button>
      <button
        onClick={cancel}
        className="t-caption text-text-muted hover:text-text"
      >
        Cancel
      </button>
      {error && <span className="t-caption text-danger">{error}</span>}
    </span>
  );
}
