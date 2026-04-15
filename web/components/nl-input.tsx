"use client";

import { useState } from "react";

export interface ParsedItem {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface Props {
  onItems: (items: ParsedItem[]) => void;
}

export function NLInput({ onItems }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setError("Describe the meal (min 3 chars)");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/nutrition/parse-nl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const body = await resp.json();
      if (!resp.ok) {
        setError(body.error ?? "Parse failed");
        return;
      }
      if (Array.isArray(body.items) && body.items.length > 0) {
        onItems(body.items as ParsedItem[]);
        setOpen(false);
        setText("");
      } else {
        setError("Couldn't parse anything from that.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="t-caption text-text-secondary hover:text-warm py-1 px-2 rounded-md border border-border-glow hover:border-warm-dim transition-colors inline-flex items-center gap-1"
      >
        <span>✎</span>
        <span>Describe a meal</span>
      </button>
    );
  }

  return (
    <div className="bg-surface-elevated border border-border-glow rounded-xl p-3 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) parse();
          if (e.key === "Escape") { setOpen(false); setText(""); }
        }}
        placeholder='e.g. "200g chicken and a cup of rice" or "2 eggs with toast and butter"'
        className="w-full bg-base/50 border border-border rounded-lg px-3 py-2 text-body text-text placeholder-text-faint focus:outline-none focus:border-warm-dim resize-none"
        rows={2}
        autoFocus
      />
      {error && (
        <p className="t-caption text-danger">{error}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="t-micro text-text-muted">⌘/Ctrl+Enter to parse</span>
        <div className="flex gap-2">
          <button
            onClick={() => { setOpen(false); setText(""); setError(null); }}
            className="t-caption text-text-muted hover:text-text py-1 px-3"
          >
            Cancel
          </button>
          <button
            onClick={parse}
            disabled={loading || text.trim().length < 3}
            className="t-caption bg-warm hover:bg-warm-light text-white py-1.5 px-3 rounded-md font-medium disabled:opacity-50"
          >
            {loading ? "Parsing..." : "Add to meal"}
          </button>
        </div>
      </div>
    </div>
  );
}
