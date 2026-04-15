"use client";

interface DateNavigatorProps {
  date: string;
  status?: string;
  trainingDayType?: string;
  onDateChange: (date: string) => void;
  onCloseDay?: () => void;
  onReopenDay?: () => void;
  onCopyYesterday?: () => void;
  hasMeals: boolean;
}

const DAY_TYPE_LABELS: Record<string, string> = {
  rest: "Rest", easy_run: "Easy Run", hard_run: "Hard Run",
  long_run: "Long Run", gym: "Gym", gym_and_run: "Gym + Run",
  race: "Race", race_eve: "Race Eve",
};

const DAY_TYPE_COLORS: Record<string, string> = {
  rest: "bg-surface-elevated text-text-secondary",
  easy_run: "bg-teal-bg text-success border-emerald-800",
  hard_run: "bg-warm-bg text-warning border-warm-dim",
  long_run: "bg-red-950 text-danger border-red-800",
  gym: "bg-teal-bg text-teal border-teal-dim",
  gym_and_run: "bg-indigo-bg text-indigo border-indigo-dim",
  race: "bg-warm-bg text-warm border-warm-dim",
  race_eve: "bg-warm-bg text-warm border-warm-dim",
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

export function DateNavigator({
  date, status, trainingDayType, onDateChange, onCloseDay, onReopenDay, onCopyYesterday, hasMeals,
}: DateNavigatorProps) {
  const today = isToday(date);
  const isClosed = status === "closed";
  const dayType = trainingDayType ?? "rest";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onDateChange(addDays(date, -1))}
          className="w-11 h-11 rounded-lg bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-white flex items-center justify-center transition-colors text-lg"
          aria-label="Previous day"
        >
          &larr;
        </button>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-text">{formatDate(date)}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${DAY_TYPE_COLORS[dayType] ?? "bg-surface-elevated text-text-secondary"}`}>
              {DAY_TYPE_LABELS[dayType] ?? dayType}
            </span>
          </div>
          {!today && (
            <button
              onClick={() => onDateChange(new Date().toISOString().split("T")[0])}
              className="text-xs text-teal hover:text-teal-light py-0.5"
            >
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => onDateChange(addDays(date, 1))}
          className="w-11 h-11 rounded-lg bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-white flex items-center justify-center transition-colors text-lg"
          aria-label="Next day"
        >
          &rarr;
        </button>
      </div>

      <div className="flex items-center gap-2">
        {isClosed && (
          <>
            <span className="text-xs px-2.5 py-1.5 rounded-full bg-surface-elevated text-text-secondary">
              Closed
            </span>
            {onReopenDay && (
              <button onClick={onReopenDay} className="text-xs text-text-muted hover:text-text underline py-1">
                reopen
              </button>
            )}
          </>
        )}

        {!isClosed && today && !hasMeals && onCopyYesterday && (
          <button
            onClick={onCopyYesterday}
            className="text-xs px-3 py-2.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-white transition-colors"
          >
            Copy yesterday
          </button>
        )}

        {!isClosed && today && hasMeals && onCloseDay && (
          <button
            onClick={onCloseDay}
            className="text-xs px-3 py-2.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-white transition-colors"
          >
            Close day
          </button>
        )}
      </div>
    </div>
  );
}
