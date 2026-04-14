"use client";

interface TrendDay {
  date: string;
  target_calories: number;
  actual_calories: number | null;
  tdee_used: number | null;
  deficit_used: number | null;
  status: string;
}

interface TrendTableProps {
  days: TrendDay[];
  currentDate: string;
}

function shortDate(d: string): string {
  const date = new Date(d + "T12:00:00");
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
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">7-Day Trend</h3>

      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-5 gap-2 text-[10px] text-slate-500 px-2">
          <span>Date</span>
          <span className="text-right">Ate</span>
          <span className="text-right">Burn</span>
          <span className="text-right">Deficit</span>
          <span className="text-right">Goal</span>
        </div>

        {/* Rows */}
        {days.map((d) => {
          const isCurrentDay = d.date === currentDate;
          const ate = d.actual_calories ?? 0;
          const burn = d.tdee_used ?? 0;
          const deficit = burn - ate;
          const goal = d.deficit_used ?? 0;
          const isClosed = d.status === "closed";

          let deficitColor = "text-slate-500";
          if (isClosed && goal > 0) {
            if (deficit >= goal) deficitColor = "text-emerald-400";
            else if (deficit >= goal - 100) deficitColor = "text-amber-400";
            else deficitColor = "text-red-400";
          }

          return (
            <div
              key={d.date}
              className={`grid grid-cols-5 gap-2 text-xs px-2 py-1 rounded ${
                isCurrentDay ? "bg-slate-800/50" : ""
              }`}
            >
              <span className="text-slate-400">
                {shortDate(d.date)}
                {isCurrentDay && <span className="text-[9px] text-slate-600 ml-1">(now)</span>}
              </span>
              <span className="text-right text-slate-300">
                {isClosed ? ate.toLocaleString() : "-"}
              </span>
              <span className="text-right text-slate-400">
                {burn > 0 ? burn.toLocaleString() : "-"}
              </span>
              <span className={`text-right ${deficitColor}`}>
                {isClosed ? deficit.toLocaleString() : "-"}
              </span>
              <span className="text-right text-slate-500">
                {goal > 0 ? `-${goal}` : "-"}
              </span>
            </div>
          );
        })}

        {/* Totals */}
        {closedDays > 0 && (
          <div className="grid grid-cols-5 gap-2 text-xs px-2 py-1.5 border-t border-slate-800 mt-1 font-medium">
            <span className="text-slate-400">Total ({closedDays}d)</span>
            <span className="text-right text-slate-300">{totalAte.toLocaleString()}</span>
            <span className="text-right text-slate-400">{totalBurn.toLocaleString()}</span>
            <span className={`text-right ${totalDeficit >= totalGoal ? "text-emerald-400" : "text-amber-400"}`}>
              {totalDeficit.toLocaleString()}
            </span>
            <span className="text-right text-slate-500">-{totalGoal.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
