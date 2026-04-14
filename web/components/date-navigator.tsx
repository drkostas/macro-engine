"use client";

interface DateNavigatorProps {
  date: string;
  status?: string;
  onDateChange: (date: string) => void;
  onCloseDay?: () => void;
  onReopenDay?: () => void;
  onCopyYesterday?: () => void;
  hasMeals: boolean;
}

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
  date, status, onDateChange, onCloseDay, onReopenDay, onCopyYesterday, hasMeals,
}: DateNavigatorProps) {
  const today = isToday(date);
  const isClosed = status === "closed";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onDateChange(addDays(date, -1))}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
        >
          &larr;
        </button>
        <div>
          <p className="text-sm text-slate-300">{formatDate(date)}</p>
          {!today && (
            <button
              onClick={() => onDateChange(new Date().toISOString().split("T")[0])}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => onDateChange(addDays(date, 1))}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
        >
          &rarr;
        </button>
      </div>

      <div className="flex items-center gap-2">
        {isClosed && (
          <>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
              Closed
            </span>
            {onReopenDay && (
              <button onClick={onReopenDay} className="text-[10px] text-slate-500 hover:text-slate-300 underline">
                reopen
              </button>
            )}
          </>
        )}

        {!isClosed && today && !hasMeals && onCopyYesterday && (
          <button
            onClick={onCopyYesterday}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            Copy yesterday
          </button>
        )}

        {!isClosed && today && hasMeals && onCloseDay && (
          <button
            onClick={onCloseDay}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            Close day
          </button>
        )}
      </div>
    </div>
  );
}
