"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export interface UndoAction {
  label: string;
  onUndo: () => Promise<void> | void;
  timeoutMs?: number;
}

interface UndoToastContextValue {
  show: (action: UndoAction) => void;
}

const UndoToastContext = createContext<UndoToastContextValue | null>(null);

export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<UndoAction | null>(null);
  const [undoing, setUndoing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCurrent(null);
    setUndoing(false);
  };

  const show = useCallback((action: UndoAction) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrent(action);
    setUndoing(false);
    timerRef.current = setTimeout(() => {
      setCurrent(null);
      timerRef.current = null;
    }, action.timeoutMs ?? 5000);
  }, []);

  const onUndoClick = async () => {
    if (!current || undoing) return;
    setUndoing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      await current.onUndo();
    } finally {
      clear();
    }
  };

  return (
    <UndoToastContext.Provider value={{ show }}>
      {children}
      {current && (
        <div
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 bg-surface-elevated border border-border-glow rounded-xl shadow-2xl px-4 py-2.5 flex items-center gap-3 z-[80]"
          role="status"
          aria-live="polite"
          aria-label="Undo action"
        >
          <span className="t-body text-text">{current.label}</span>
          <button
            onClick={onUndoClick}
            disabled={undoing}
            className="t-caption text-teal hover:text-teal-light font-semibold underline py-0.5 px-1 disabled:opacity-50"
          >
            {undoing ? "..." : "Undo"}
          </button>
          <button
            onClick={clear}
            aria-label="Dismiss"
            className="t-caption text-text-faint hover:text-text-secondary w-6 h-6 flex items-center justify-center"
          >
            ×
          </button>
        </div>
      )}
    </UndoToastContext.Provider>
  );
}

export function useUndoToast() {
  const ctx = useContext(UndoToastContext);
  if (!ctx) throw new Error("useUndoToast must be used inside UndoToastProvider");
  return ctx;
}
