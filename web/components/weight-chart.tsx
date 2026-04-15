"use client";

import { useEffect, useState } from "react";
import { InfoTip } from "./info-tip";

interface TrendPoint {
  date: string;
  weight: number;
  avg7d: number;
  bfPct: number | null;
}

interface ProjectionPoint {
  date: string;
  weight: number;
  bfPct: number | null;
}

interface GoalInfo {
  targetWeight: number | null;
  targetBf: number | null;
  targetDate: string | null;
  fatToLose: number | null;
  daysRemaining: number | null;
  weeklyRateLoss: number | null;
  progressPct: number | null;
}

interface CurrentInfo {
  weight: number;
  bfPct: number | null;
  deficit: number;
}

interface WeightTrendData {
  trend: TrendPoint[];
  projection: ProjectionPoint[];
  current: CurrentInfo;
  goal: GoalInfo;
}

export function WeightChart() {
  const [data, setData] = useState<WeightTrendData | null>(null);
  const [days, setDays] = useState(30);
  const [showWeight, setShowWeight] = useState(true);
  const [showBf, setShowBf] = useState(true);

  useEffect(() => {
    fetch(`/api/nutrition/weight-trend?days=${days}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {});
  }, [days]);

  if (!data || data.trend.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-4">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Weight Trend</h3>
        <p className="text-sm text-text-muted">No weigh-in data yet. Close a day with a weigh-in to start tracking.</p>
      </div>
    );
  }

  const { trend, projection, current, goal } = data;

  // Chart dimensions
  const W = 600, H = 220, PAD_L = 45, PAD_R = 40, PAD_T = 15, PAD_B = 30;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  // Combine trend + projection for x-axis range
  const allDates = [...trend.map((t) => t.date), ...projection.map((p) => p.date)];
  const totalPoints = allDates.length;

  // Weight bounds
  const weights = trend.map((t) => t.weight);
  const avgs = trend.map((t) => t.avg7d).filter((v) => v > 0);
  const projWeights = projection.map((p) => p.weight);
  const allWeights = [...weights, ...avgs, ...projWeights];
  if (goal.targetWeight) allWeights.push(goal.targetWeight);

  const minW = Math.floor(Math.min(...allWeights) - 0.5);
  const maxW = Math.ceil(Math.max(...allWeights) + 0.5);
  const rangeW = maxW - minW || 1;

  // BF% bounds (right axis)
  const bfValues = trend.map((t) => t.bfPct).filter((v): v is number => v != null);
  const projBf = projection.map((p) => p.bfPct).filter((v): v is number => v != null);
  const allBf = [...bfValues, ...projBf];
  if (goal.targetBf) allBf.push(goal.targetBf);
  const hasBf = allBf.length > 0 && showBf;
  const minBf = hasBf ? Math.floor(Math.min(...allBf) - 1) : 0;
  const maxBf = hasBf ? Math.ceil(Math.max(...allBf) + 1) : 30;
  const rangeBf = maxBf - minBf || 1;

  const xScale = (i: number) => PAD_L + (i / Math.max(totalPoints - 1, 1)) * chartW;
  const yWeight = (v: number) => PAD_T + (1 - (v - minW) / rangeW) * chartH;
  const yBf = (v: number) => PAD_T + (1 - (v - minBf) / rangeBf) * chartH;

  // SVG paths
  const avgPoints = trend
    .map((t, i) => (t.avg7d > 0 ? `${xScale(i)},${yWeight(t.avg7d)}` : null))
    .filter(Boolean);
  const avgPath = avgPoints.length > 1 ? `M ${avgPoints.join(" L ")}` : "";

  // BF% line
  const bfPoints = trend
    .map((t, i) => (t.bfPct != null ? `${xScale(i)},${yBf(t.bfPct)}` : null))
    .filter(Boolean);
  const bfPath = bfPoints.length > 1 ? `M ${bfPoints.join(" L ")}` : "";

  // Projection line (dashed, continues from last trend point)
  const projStartIdx = trend.length;
  const projPathPoints = projection.map((p, i) => `${xScale(projStartIdx + i)},${yWeight(p.weight)}`);
  if (trend.length > 0) {
    const lastTrend = trend[trend.length - 1];
    projPathPoints.unshift(`${xScale(trend.length - 1)},${yWeight(lastTrend.avg7d || lastTrend.weight)}`);
  }
  const projPath = projPathPoints.length > 1 ? `M ${projPathPoints.join(" L ")}` : "";

  // BF projection line
  const bfProjPoints = projection
    .filter((p) => p.bfPct != null)
    .map((p, i) => `${xScale(projStartIdx + i)},${yBf(p.bfPct!)}`);
  if (trend.length > 0 && trend[trend.length - 1].bfPct != null) {
    bfProjPoints.unshift(`${xScale(trend.length - 1)},${yBf(trend[trend.length - 1].bfPct!)}`);
  }
  const bfProjPath = bfProjPoints.length > 1 ? `M ${bfProjPoints.join(" L ")}` : "";

  // Goal lines
  const goalWeightY = goal.targetWeight ? yWeight(goal.targetWeight) : null;
  const goalBfY = hasBf && goal.targetBf ? yBf(goal.targetBf) : null;

  // Y-axis ticks
  const yTicks: number[] = [];
  const step = rangeW <= 3 ? 0.5 : rangeW <= 6 ? 1 : 2;
  for (let v = Math.ceil(minW / step) * step; v <= maxW; v += step) yTicks.push(v);

  const bfTicks: number[] = [];
  if (hasBf) {
    const bfStep = rangeBf <= 5 ? 1 : 2;
    for (let v = Math.ceil(minBf / bfStep) * bfStep; v <= maxBf; v += bfStep) bfTicks.push(v);
  }

  // X-axis labels
  const xLabelInterval = Math.max(1, Math.floor(totalPoints / 5));
  const shortDate = (d: string) => {
    const dateStr = d.includes("T") ? d : d + "T12:00:00";
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return d.substring(0, 10);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center">
          Weight Trend
          <InfoTip text="Track daily weigh-ins vs 7-day average. Dashed line shows projected weight if current rate continues. Goal line is your target." />
        </h3>
        <div className="flex gap-1 items-center">
          <button
            onClick={() => setShowWeight(!showWeight)}
            className={`px-2 py-0.5 text-[10px] rounded ${showWeight ? "bg-teal-dim text-white" : "bg-surface-elevated text-text-secondary"}`}
          >
            Weight
          </button>
          <button
            onClick={() => setShowBf(!showBf)}
            className={`px-2 py-0.5 text-[10px] rounded ${showBf ? "bg-orange-600 text-white" : "bg-surface-elevated text-text-secondary"}`}
          >
            BF%
          </button>
          {[30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-0.5 text-[10px] rounded ${days === d ? "bg-teal-dim text-white" : "bg-surface-elevated text-text-secondary"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-3 text-xs flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-text-secondary">Now:</span>
          <span className="text-text font-semibold">{current.weight.toFixed(1)} kg</span>
          {current.bfPct != null && (
            <span className="text-warning">({current.bfPct.toFixed(1)}%)</span>
          )}
        </div>
        {goal.targetWeight && (
          <>
            <span className="text-text-faint">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-text-secondary">Goal:</span>
              <span className="text-success font-semibold">{goal.targetWeight.toFixed(1)} kg</span>
              {goal.targetBf && <span className="text-warning">({goal.targetBf}%)</span>}
            </div>
          </>
        )}
        {goal.fatToLose != null && goal.fatToLose > 0 && (
          <>
            <span className="text-text-faint">|</span>
            <span className="text-warm">{goal.fatToLose.toFixed(1)} kg to go</span>
          </>
        )}
        {goal.weeklyRateLoss != null && (
          <>
            <span className="text-text-faint">|</span>
            <span className="text-text-muted">{goal.weeklyRateLoss} kg/wk</span>
          </>
        )}
      </div>

      {/* Progress bar */}
      {goal.progressPct != null && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-text-muted mb-1">
            <span>Progress</span>
            <span>{goal.progressPct}%{goal.daysRemaining != null && goal.daysRemaining > 0 && ` · ${goal.daysRemaining}d left`}</span>
          </div>
          <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-500"
              style={{ width: `${Math.max(goal.progressPct, 2)}%` }}
            />
          </div>
        </div>
      )}

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Weight grid lines (left axis) */}
        {yTicks.map((v) => (
          <g key={`wt-${v}`}>
            <line x1={PAD_L} y1={yWeight(v)} x2={W - PAD_R} y2={yWeight(v)} stroke="#1E293B" strokeWidth={1} />
            {showWeight && (
              <text x={PAD_L - 5} y={yWeight(v) + 3} textAnchor="end" fill="#64748B" fontSize={9}>
                {v.toFixed(step < 1 ? 1 : 0)}
              </text>
            )}
          </g>
        ))}

        {/* BF% axis (right side) */}
        {hasBf && bfTicks.map((v) => (
          <text key={`bf-${v}`} x={W - PAD_R + 5} y={yBf(v) + 3} textAnchor="start" fill="#FB923C" fontSize={8} opacity={0.5}>
            {v}%
          </text>
        ))}

        {/* Goal weight line */}
        {showWeight && goalWeightY != null && (
          <>
            <line x1={PAD_L} y1={goalWeightY} x2={W - PAD_R} y2={goalWeightY}
              stroke="#10B981" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
            <text x={PAD_L + 3} y={goalWeightY - 4} fill="#10B981" fontSize={8} opacity={0.7}>goal {goal.targetWeight}kg</text>
          </>
        )}

        {/* Goal BF% line */}
        {goalBfY != null && (
          <line x1={PAD_L} y1={goalBfY} x2={W - PAD_R} y2={goalBfY}
            stroke="#FB923C" strokeWidth={1} strokeDasharray="2 3" opacity={0.3} />
        )}

        {/* Projection line (dashed) */}
        {showWeight && projPath && (
          <path d={projPath} fill="none" stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.5} />
        )}

        {/* BF% projection (dashed) */}
        {hasBf && bfProjPath && (
          <path d={bfProjPath} fill="none" stroke="#FB923C" strokeWidth={1} strokeDasharray="4 3" opacity={0.3} />
        )}

        {/* 7-day average line */}
        {showWeight && avgPath && (
          <path d={avgPath} fill="none" stroke="#3B82F6" strokeWidth={2} opacity={0.8} />
        )}

        {/* BF% line */}
        {hasBf && bfPath && (
          <path d={bfPath} fill="none" stroke="#FB923C" strokeWidth={1.5} opacity={0.6} />
        )}

        {/* Weight dots */}
        {showWeight && trend.map((t, i) => (
          <circle key={t.date} cx={xScale(i)} cy={yWeight(t.weight)} r={2.5} fill="#94A3B8" opacity={0.6} />
        ))}

        {/* X-axis dates */}
        {allDates.map((d, i) =>
          i % xLabelInterval === 0 || i === allDates.length - 1 ? (
            <text key={`x-${d}`} x={xScale(i)} y={H - 5} textAnchor="middle" fill="#64748B" fontSize={9}>
              {shortDate(d)}
            </text>
          ) : null,
        )}

        {/* Divider between historical and projection */}
        {projection.length > 0 && (
          <line x1={xScale(trend.length - 1)} y1={PAD_T} x2={xScale(trend.length - 1)} y2={H - PAD_B}
            stroke="#334155" strokeWidth={1} strokeDasharray="2 2" />
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-text-muted">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-text-secondary" />
            <span>Daily</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-teal rounded" />
            <span>7d Avg</span>
          </div>
          {projection.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-0 border-t border-dashed border-teal opacity-50" />
              <span>Projected</span>
            </div>
          )}
          {hasBf && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 bg-warm rounded opacity-60" />
              <span>BF%</span>
            </div>
          )}
          {goalWeightY != null && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-0 border-t border-dashed border-emerald-500 opacity-50" />
              <span>Goal</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
