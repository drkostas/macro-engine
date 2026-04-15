"use client";

import { InfoTip } from "./info-tip";

interface TrendDay {
  date: string;
  target_calories: number;
  actual_calories: number | null;
  tdee_used: number | null;
  deficit_used: number | null;
  status: string;
  training_day_type?: string;
}

interface TrendTableProps {
  days: TrendDay[];
  currentDate: string;
}

const DAY_TYPE_SHORT: Record<string, string> = {
  rest: "Rest", easy_run: "Easy", hard_run: "Hard", long_run: "Long",
  gym: "Gym", gym_and_run: "G+R", race: "Race", race_eve: "RcEve",
};

const DAY_TYPE_COLOR: Record<string, string> = {
  rest: "text-text-muted", easy_run: "text-emerald-500", hard_run: "text-warning",
  long_run: "text-danger", gym: "text-teal", gym_and_run: "text-indigo",
  race: "text-warm", race_eve: "text-warm-dim",
};

function shortDate(d: string): string {
  const dateStr = d.includes("T") ? d : d + "T12:00:00";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return d.substring(0, 10);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function TrendTable({ days, currentDate }: TrendTableProps) {
  if (days.length === 0) return null;

  let totalAte = 0;
  let totalBurn = 0;
  let totalDeficit = 0;
  let totalGoal = 0;
  let closedDays = 0;

  for (const d of days) {
    if (d.status === "closed" && d.actual_calories != null) {
      totalAte += d.actual_calories;
      totalBurn += d.tdee_used ?? 0;
      totalDeficit += (d.tdee_used ?? 0) - d.actual_calories;
      totalGoal += d.deficit_used ?? 0;
      closedDays++;
    }
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center">
        7-Day Trend
        <InfoTip text="Daily nutrition summary. Green deficit = you hit your goal. Amber = close. Red = missed. Training type shows why targets differ day-to-day." />
      </h3>

      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-5 md:grid-cols-6 gap-1.5 text-[10px] text-text-muted px-2">
          <span>Date</span>
          <span className="text-center">Type</span>
          <span className="text-right">Ate</span>
          <span className="text-right hidden md:block">Burn</span>
          <span className="text-right">Deficit</span>
          <span className="text-right">Goal</span>
        </div>

        {/* Rows */}
        {days.map((d) => {
          const isCurrentDay = d.date.substring(0, 10) === currentDate.substring(0, 10);
          const ate = d.actual_calories ?? 0;
          const burn = d.tdee_used ?? 0;
          const deficit = burn - ate;
          const goal = d.deficit_used ?? 0;
          const isClosed = d.status === "closed";
          const dayType = d.training_day_type ?? "rest";

          let deficitColor = "text-text-muted";
          if (isClosed && goal > 0) {
            if (deficit >= goal) deficitColor = "text-success";
            else if (deficit >= goal - 100) deficitColor = "text-warm";
            else deficitColor = "text-danger";
          }

          return (
            <div
              key={d.date}
              className={`grid grid-cols-5 md:grid-cols-6 gap-1.5 text-xs px-2 py-1.5 rounded ${
                isCurrentDay ? "bg-surface-elevated/50" : ""
              }`}
            >
              <span className="text-text-secondary truncate">
                {shortDate(d.date)}
                {isCurrentDay && <span className="text-[9px] text-text-faint ml-1">(now)</span>}
              </span>
              <span className={`text-center text-[10px] font-medium ${DAY_TYPE_COLOR[dayType] ?? "text-text-muted"}`}>
                {DAY_TYPE_SHORT[dayType] ?? dayType}
              </span>
              <span className="text-right text-text">
                {isClosed ? ate.toLocaleString() : "-"}
              </span>
              <span className="text-right text-text-secondary hidden md:block">
                {burn > 0 ? burn.toLocaleString() : "-"}
              </span>
              <span className={`text-right ${deficitColor}`}>
                {isClosed ? deficit.toLocaleString() : "-"}
              </span>
              <span className="text-right text-text-muted">
                {goal > 0 ? `-${goal}` : "-"}
              </span>
            </div>
          );
        })}

        {/* Totals */}
        {closedDays > 0 && (
          <div className="grid grid-cols-5 md:grid-cols-6 gap-1.5 text-xs px-2 py-1.5 border-t border-border mt-1 font-medium">
            <span className="text-text-secondary">Total ({closedDays}d)</span>
            <span />
            <span className="text-right text-text">{totalAte.toLocaleString()}</span>
            <span className="text-right text-text-secondary hidden md:block">{totalBurn.toLocaleString()}</span>
            <span className={`text-right ${totalDeficit >= totalGoal ? "text-success" : "text-warm"}`}>
              {totalDeficit.toLocaleString()}
            </span>
            <span className="text-right text-text-muted">-{totalGoal.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
