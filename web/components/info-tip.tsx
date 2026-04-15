"use client";

import { useState, useRef, useEffect } from "react";

interface InfoTipProps {
  text: string;
  children?: React.ReactNode;
}

/**
 * Lightweight tooltip triggered by hover/tap on an info icon.
 * No external dependencies. Pure CSS positioning.
 */
export function InfoTip({ text, children }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click (mobile)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <span className="relative inline-flex items-center" ref={ref}>
      {children ?? (
        <button
          onClick={() => setOpen(!open)}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="w-4 h-4 rounded-full bg-surface-elevated text-text-muted text-[9px] font-bold flex items-center justify-center hover:bg-surface-hover hover:text-text transition-colors cursor-help ml-1"
          aria-label="More info"
        >
          i
        </button>
      )}
      {open && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-elevated border border-border-glow rounded-lg text-xs text-text leading-relaxed shadow-xl max-w-[240px] w-max animate-in fade-in-0 zoom-in-95 duration-150">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-border-glow" />
        </span>
      )}
    </span>
  );
}
