"use client";

import { useEffect, useState } from "react";

interface Step {
  target: string;          // value of data-tour attribute on the target element
  title: string;
  body: string;
  placement: "below" | "above";
}

const STEPS: Step[] = [
  {
    target: "hero",
    title: "Your day at a glance",
    body: "This big number is calories eaten today. The rings show progress toward each macro target.",
    placement: "below",
  },
  {
    target: "activity",
    title: "Activities adapt your target",
    body: "Toggle today's run or gym sessions. Your calorie budget updates instantly based on what you've done.",
    placement: "below",
  },
  {
    target: "meal-cards",
    title: "Log meals here",
    body: "Tap any slot to add food. Your portions are auto-solved to hit targets, and 'Recent' gives one-tap repeat.",
    placement: "above",
  },
  {
    target: "weight-chart",
    title: "Track progress",
    body: "Daily weigh-ins vs 7-day average plus a forward projection toward your goal weight.",
    placement: "above",
  },
];

const STORAGE_KEY = "me_tour_done";

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Decide on mount whether to run the tour
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    // Wait a beat so the target elements are in the DOM
    const t = setTimeout(() => setOpen(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Measure current target's rect (re-measure on resize + scroll)
  useEffect(() => {
    if (!open) return;
    const step = STEPS[index];
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Delay to let the scroll settle
      window.setTimeout(() => {
        setRect(el.getBoundingClientRect());
      }, 300);
    };
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize);
    };
  }, [open, index]);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const next = () => {
    if (index < STEPS.length - 1) setIndex((i) => i + 1);
    else finish();
  };

  const prev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  if (!open) return null;

  const step = STEPS[index];
  const TOOLTIP_W = 340;
  const TOOLTIP_H = 180;

  // Compute tooltip position
  let tooltipTop = 0;
  let tooltipLeft = 0;
  if (rect) {
    tooltipLeft = Math.max(16, Math.min(window.innerWidth - TOOLTIP_W - 16,
      rect.left + rect.width / 2 - TOOLTIP_W / 2,
    ));
    tooltipTop = step.placement === "below"
      ? rect.bottom + 16
      : Math.max(16, rect.top - TOOLTIP_H - 16);
  }

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-label="Onboarding tour"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={next} />

      {/* Highlight ring around target */}
      {rect && (
        <div
          className="absolute rounded-2xl pointer-events-none border-2 border-warm"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6), 0 0 24px rgba(177,120,80,0.4)",
          }}
        />
      )}

      {/* Tooltip */}
      {rect && (
        <div
          className="absolute bg-surface-elevated border border-border-glow rounded-2xl shadow-2xl p-5"
          style={{ top: tooltipTop, left: tooltipLeft, width: TOOLTIP_W }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="t-eyebrow">Step {index + 1} of {STEPS.length}</span>
            <button
              onClick={finish}
              className="t-caption text-text-muted hover:text-text"
            >
              Skip
            </button>
          </div>
          <h3 className="t-title text-text mb-1">{step.title}</h3>
          <p className="t-body text-text-secondary mb-4">{step.body}</p>
          <div className="flex items-center justify-between">
            <button
              onClick={prev}
              disabled={index === 0}
              className="t-caption text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1"
            >
              ← Back
            </button>
            <button
              onClick={next}
              className="bg-warm hover:bg-warm-light text-white t-body font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {index === STEPS.length - 1 ? "Finish" : "Next →"}
            </button>
          </div>
        </div>
      )}

      {/* If target element wasn't found, show a centered tooltip so the user isn't stuck */}
      {!rect && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-elevated border border-border-glow rounded-2xl shadow-2xl p-5"
          style={{ width: TOOLTIP_W }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="t-eyebrow">Step {index + 1} of {STEPS.length}</span>
            <button onClick={finish} className="t-caption text-text-muted hover:text-text">Skip</button>
          </div>
          <h3 className="t-title text-text mb-1">{step.title}</h3>
          <p className="t-body text-text-secondary mb-4">{step.body}</p>
          <div className="flex items-center justify-between">
            <button
              onClick={prev}
              disabled={index === 0}
              className="t-caption text-text-muted hover:text-text disabled:opacity-40 px-2 py-1"
            >
              ← Back
            </button>
            <button
              onClick={next}
              className="bg-warm hover:bg-warm-light text-white t-body font-medium px-4 py-2 rounded-lg"
            >
              {index === STEPS.length - 1 ? "Finish" : "Next →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
