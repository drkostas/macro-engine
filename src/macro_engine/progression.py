"""M10 Phase B — 30/60/90-day progression snapshot.

Long-window progress summary: weight delta, adherence average, avg deficit,
training days. Mirrors weekly_wrapup's aggregator pattern but with a
parameterized window length.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import List, Optional


_ADHERENCE_TOLERANCE: float = 0.10
_ALLOWED_WINDOWS: frozenset[int] = frozenset({30, 60, 90})


@dataclass(frozen=True)
class DayRecord:
    day: date
    target_kcal: int
    actual_kcal: int
    weight_kg: Optional[float] = None
    had_training: bool = False
    was_closed: bool = True
    tdee_kcal: Optional[float] = None


@dataclass(frozen=True)
class ProgressionWindow:
    window_days: int
    days_total: int
    days_closed: int
    weight_delta_kg: Optional[float]
    weight_delta_per_week: Optional[float]
    adherence_avg_pct: int
    avg_daily_deficit: int
    training_days: int


def _day_hits_target(d: DayRecord) -> bool:
    if d.target_kcal <= 0:
        return False
    return abs(d.actual_kcal - d.target_kcal) / d.target_kcal <= _ADHERENCE_TOLERANCE


def _day_deficit(d: DayRecord) -> int:
    if d.tdee_kcal is not None:
        return int(round(d.tdee_kcal - d.actual_kcal))
    if d.target_kcal > 0:
        # Fallback: treat target as a deficit-aware figure.
        return int(round(d.target_kcal - d.actual_kcal))
    return 0


def compute_progression_window(
    days: List[DayRecord],
    *,
    weight_kg: float,
    window_days: int,
) -> ProgressionWindow:
    if window_days not in _ALLOWED_WINDOWS:
        raise ValueError(
            f"window_days must be one of {sorted(_ALLOWED_WINDOWS)}, got {window_days}",
        )
    del weight_kg  # reserved for future per-kg metrics

    if not days:
        return ProgressionWindow(
            window_days=window_days, days_total=0, days_closed=0,
            weight_delta_kg=None, weight_delta_per_week=None,
            adherence_avg_pct=0, avg_daily_deficit=0, training_days=0,
        )

    ordered = sorted(days, key=lambda d: d.day)
    closed = [d for d in ordered if d.was_closed]

    hits = sum(1 for d in closed if _day_hits_target(d))
    adherence_avg_pct = round(100 * hits / len(closed)) if closed else 0

    avg_daily_deficit = (
        round(sum(_day_deficit(d) for d in closed) / len(closed)) if closed else 0
    )

    training_days = sum(1 for d in ordered if d.had_training)

    weights = [(d.day, d.weight_kg) for d in ordered if d.weight_kg is not None]
    weight_delta_kg: Optional[float] = None
    weight_delta_per_week: Optional[float] = None
    if len(weights) >= 2:
        weight_delta_kg = round(weights[-1][1] - weights[0][1], 2)
        span_days = max(1, (weights[-1][0] - weights[0][0]).days)
        weight_delta_per_week = round(weight_delta_kg / span_days * 7, 2)

    return ProgressionWindow(
        window_days=window_days,
        days_total=len(ordered),
        days_closed=len(closed),
        weight_delta_kg=weight_delta_kg,
        weight_delta_per_week=weight_delta_per_week,
        adherence_avg_pct=adherence_avg_pct,
        avg_daily_deficit=avg_daily_deficit,
        training_days=training_days,
    )
