"use client";

interface Props {
  active: boolean;
}

/**
 * Danger-tone warning shown when sustained high water intake without
 * electrolytes is detected. Copy steers the user toward adding sodium
 * rather than stopping water.
 */
export function HyponatremiaBanner({ active }: Props) {
  if (!active) return null;
  return (
    <div
      role="status"
      data-testid="hyponatremia-banner"
      className="flex items-start gap-3 border border-danger/40 bg-danger/15 text-danger rounded-lg px-3 py-2 text-xs"
    >
      <div className="flex-1">
        <p className="font-semibold leading-tight">Hyponatremia risk</p>
        <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
          High water intake without electrolytes for 3+ hours. Add sodium
          (~300 mg/hr of continued drinking) rather than reducing water.
        </p>
      </div>
    </div>
  );
}
