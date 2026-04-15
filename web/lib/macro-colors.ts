/** Canonical macro color system - warm/cool palette from design spec */

export const MACRO_COLORS = {
  calories: { hex: "#77C8D1", text: "text-teal",     bg: "bg-teal",     border: "border-teal" },
  protein:  { hex: "#B17850", text: "text-warm",     bg: "bg-warm",     border: "border-warm" },
  carbs:    { hex: "#6366B0", text: "text-indigo",   bg: "bg-indigo",   border: "border-indigo" },
  fat:      { hex: "#CBE896", text: "text-lime",     bg: "bg-lime",     border: "border-lime" },
  fiber:    { hex: "#82D0C8", text: "text-teal-light", bg: "bg-teal-light", border: "border-teal-light" },
} as const;

/** Status colors based on progress percentage */
export function progressColor(pct: number): string {
  if (pct >= 90 && pct <= 110) return "text-success";
  if (pct >= 70 || (pct > 110 && pct <= 120)) return "text-warning";
  return "text-danger";
}

/** Status colors for deficit adherence */
export function deficitColor(actual: number, goal: number): string {
  if (goal <= 0) return "text-text-muted";
  if (actual >= goal) return "text-success";
  if (actual >= goal - 100) return "text-warning";
  return "text-danger";
}
