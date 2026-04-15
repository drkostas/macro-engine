"use client";

export interface DayCompleteData {
  actualCalories: number;
  targetCalories: number;
  tdee: number;
  goalDeficit: number;
  actualProtein: number;
  proteinTarget: number;
  streak?: number;
}

interface Props {
  open: boolean;
  data: DayCompleteData | null;
  onDismiss: () => void;
}

function renderAdherence(d: DayCompleteData) {
  const actualDeficit = Math.round(d.tdee - d.actualCalories);
  const goal = Math.round(d.goalDeficit);
  if (goal <= 0) {
    return { tone: "neutral" as const, text: "Day logged." };
  }
  if (actualDeficit >= goal) {
    const margin = actualDeficit - goal;
    return {
      tone: "success" as const,
      text: margin > 50
        ? `Deficit hit with ${margin} kcal to spare — nice.`
        : `Deficit hit on target (${actualDeficit} vs ${goal}).`,
    };
  }
  if (actualDeficit >= goal - 100) {
    return {
      tone: "warn" as const,
      text: `Close to target (${actualDeficit} vs ${goal}). Missed by ${goal - actualDeficit} kcal.`,
    };
  }
  if (actualDeficit < 0) {
    return {
      tone: "danger" as const,
      text: `Ate ${Math.abs(actualDeficit)} kcal over maintenance today.`,
    };
  }
  return {
    tone: "danger" as const,
    text: `Deficit short by ${goal - actualDeficit} kcal (${actualDeficit} vs ${goal}).`,
  };
}

function renderProtein(d: DayCompleteData) {
  if (d.proteinTarget <= 0) return null;
  const hit = d.actualProtein >= d.proteinTarget * 0.9;
  return {
    hit,
    text: hit
      ? `Protein hit (${Math.round(d.actualProtein)}g / ${d.proteinTarget}g).`
      : `Protein short (${Math.round(d.actualProtein)}g / ${d.proteinTarget}g).`,
  };
}

function isStreakMilestone(streak: number): "7" | "30" | "100" | null {
  if (streak === 100) return "100";
  if (streak === 30) return "30";
  if (streak === 7) return "7";
  return null;
}

export function DayCompleteModal({ open, data, onDismiss }: Props) {
  if (!open || !data) return null;

  const adherence = renderAdherence(data);
  const protein = renderProtein(data);
  const milestone = isStreakMilestone(data.streak ?? 0);

  const toneClass = {
    success: "text-success",
    warn: "text-warm",
    danger: "text-danger",
    neutral: "text-text-secondary",
  }[adherence.tone];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-label="Day complete"
      onClick={onDismiss}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-surface-elevated border border-border-glow rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <span className="t-eyebrow">Day closed</span>
          {milestone && (
            <div className="t-headline text-warm mt-2" aria-label="Streak milestone">
              {milestone === "100" && "🏆 100-day streak!"}
              {milestone === "30" && "🔥 30-day streak!"}
              {milestone === "7" && "⭐ 7-day streak!"}
            </div>
          )}
        </div>

        {/* Adherence */}
        <div className={`t-body mb-3 ${toneClass}`}>
          {adherence.text}
        </div>

        {/* Protein line */}
        {protein && (
          <div className={`t-body mb-3 ${protein.hit ? "text-success" : "text-warm"}`}>
            {protein.hit ? "✓" : "!"} {protein.text}
          </div>
        )}

        {/* Streak */}
        {typeof data.streak === "number" && data.streak > 0 && !milestone && (
          <div className="t-body text-text-secondary mb-3">
            🔥 {data.streak} day{data.streak === 1 ? "" : "s"} on track.
          </div>
        )}

        {/* Ate vs target summary */}
        <div className="bg-base/50 rounded-2xl p-3 grid grid-cols-3 gap-2 t-caption tnum mb-5">
          <div>
            <div className="text-text-muted">Ate</div>
            <div className="text-text font-semibold">{Math.round(data.actualCalories).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-text-muted">Target</div>
            <div className="text-text">{Math.round(data.targetCalories).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-text-muted">Burn</div>
            <div className="text-text">{Math.round(data.tdee).toLocaleString()}</div>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="w-full bg-warm hover:bg-warm-light text-white t-body font-medium py-2.5 rounded-xl transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
