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

  // Over target: warning, then danger
  const ringColor = isOver ? (pct > 1.1 ? "#E06060" : "#E0A458") : color;

  return (
    <div className="flex flex-col items-center gap-1 cursor-default hover:scale-105 transition-transform">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke="var(--color-surface-elevated)" strokeWidth={size > 80 ? 8 : 6}
          />
          {/* Progress arc */}
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke={ringColor} strokeWidth={size > 80 ? 8 : 6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: "stroke-dashoffset 0.5s ease",
              filter: `drop-shadow(0 0 ${size > 80 ? 4 : 2}px ${ringColor}40)`,
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${size > 80 ? "text-lg" : "text-sm"}`} style={{ color: ringColor }}>
            {current.toLocaleString()}
          </span>
          <span className={`text-text-muted ${size > 80 ? "text-xs" : "text-[9px]"}`}>
            / {target.toLocaleString()}{unit}
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <span className="text-[10px]" style={{ color: ringColor }}>
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}
