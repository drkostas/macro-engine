"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
    target: "tracking-tabs",
    title: "Track the arc, not just today",
    body: "Week gives you a Monday-morning wrap-up with a letter grade. Progress shows 30 / 60 / 90-day trends. Year rolls up the whole year with a JSON download.",
    placement: "above",
  },
  {
    target: "weight-chart",
    title: "Track progress",
    body: "Daily weigh-ins vs 7-day average plus a forward projection toward your goal weight.",
    placement: "above",
  },
  {
    target: "settings-link",
    title: "Injury, race, climate",
    body: "Got a hurt knee, a race on the calendar, or heading to altitude? Flag it in Settings → Injury & Race and your targets adapt automatically.",
    placement: "below",
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

  // Bring the step's target into view, then measure it once the scroll has ENDED. A fixed
  // 300 ms after a smooth scrollIntoView measured mid-scroll on slower machines, which put the
  // tooltip (and its Next/Skip buttons) outside the viewport (macro-engine#260). `scrollend`
  // is the signal; a timer covers browsers without it and the case where nothing scrolls.
  useEffect(() => {
    if (!open) return;
    const step = STEPS[index];
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      // No target on this page: the centred tooltip, cleared on the next tick like the
      // measured path (never a synchronous setState inside the effect).
      const clear = window.setTimeout(() => setRect(null), 0);
      return () => window.clearTimeout(clear);
    }
    const target = el;
    let settled = false;
    let fallback = 0;
    const measure = () => setRect(target.getBoundingClientRect());
    const onScrollEnd = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallback);
      measure();
    };
    window.addEventListener("scrollend", onScrollEnd, { once: true });
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    fallback = window.setTimeout(onScrollEnd, 700);
    // After that first measurement, a resize or a user scroll only re-measures; it never scrolls
    // the page again (the old listener called scrollIntoView on every scroll event).
    const remeasure = () => { if (settled) measure(); };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, { passive: true });
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener("scrollend", onScrollEnd);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure);
    };
  }, [open, index]);

  // The tooltip's real height depends on the step's text, so the clamp below (which uses the
  // TOOLTIP_H estimate) is corrected against the rendered box before paint: the bottom edge
  // must stay inside the viewport or Next and Skip are unreachable (macro-engine#260).
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const maxTop = window.innerHeight - el.offsetHeight - 16;
    const top = Number.parseFloat(el.style.top);
    if (Number.isFinite(top) && top > maxTop) el.style.top = `${Math.max(16, maxTop)}px`;
  });

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

  // Compute tooltip position, clamped to the viewport on both axes so the buttons are always
  // reachable whatever the target's position at measurement time.
  let tooltipTop = 0;
  let tooltipLeft = 0;
  if (rect) {
    tooltipLeft = Math.max(16, Math.min(window.innerWidth - TOOLTIP_W - 16,
      rect.left + rect.width / 2 - TOOLTIP_W / 2,
    ));
    const wanted = step.placement === "below" ? rect.bottom + 16 : rect.top - TOOLTIP_H - 16;
    tooltipTop = Math.max(16, Math.min(window.innerHeight - TOOLTIP_H - 16, wanted));
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
          ref={tooltipRef}
          data-testid="tour-tooltip"
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
