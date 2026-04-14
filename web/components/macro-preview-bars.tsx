"use client";

interface MacroPreviewBarsProps {
  current: { calories: number; protein: number; carbs: number; fat: number };
  budget: { calories: number; protein: number; carbs: number; fat: number };
}

const MACROS: { key: string; label: string; color: string }[] = [
  { key: "calories", label: "kcal", color: "#3B82F6" },
  { key: "protein", label: "P", color: "#EF4444" },
  { key: "carbs", label: "C", color: "#F59E0B" },
  { key: "fat", label: "F", color: "#10B981" },
];

export function MacroPreviewBars({ current, budget }: MacroPreviewBarsProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {MACROS.map(({ key, label, color }) => {
        const cur = (current as Record<string, number>)[key] ?? 0;
        const bud = (budget as Record<string, number>)[key] ?? 1;
        const pct = bud > 0 ? Math.min(cur / bud, 1.5) : 0;
        const isOver = cur > bud;

        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-400">{label}</span>
              <span className={isOver ? "text-amber-400" : "text-slate-300"}>
                {Math.round(cur)}/{Math.round(bud)}
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${Math.min(pct * 100, 100)}%`,
                  backgroundColor: isOver ? "#F59E0B" : color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
