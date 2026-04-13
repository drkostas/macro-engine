"use client";

interface MacroRingProps {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
  size?: number;
}

export function MacroRing({ label, current, target, unit, color, size = 120 }: MacroRingProps) {
  const pct = target > 0 ? Math.min(current / target, 1.5) : 0;
  const isOver = current > target;
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(pct, 1));
  const center = size / 2;

  const ringColor = isOver ? (pct > 1.1 ? "#EF4444" : "#F59E0B") : color;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke="#1E293B" strokeWidth={8}
          />
          {/* Progress */}
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke={ringColor} strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold" style={{ color: ringColor }}>
            {current.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-500">
            / {target.toLocaleString()}{unit}
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="text-[10px]" style={{ color: ringColor }}>
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}
