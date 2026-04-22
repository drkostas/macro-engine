"""M10 Phase C — Year-in-review aggregator.

Annual summary: totals + 12-month breakdown. Pure function; consumer
handles persistence and export.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional


_ADHERENCE_TOLERANCE: float = 0.10
_MIN_YEAR: int = 1970
_MAX_YEAR: int = 9999


@dataclass(frozen=True)
class YearDayRecord:
    day: date
    target_kcal: int
    actual_kcal: int
    protein_g: float
    weight_kg: Optional[float] = None
    had_training: bool = False
    was_closed: bool = True


@dataclass(frozen=True)
class MonthSummary:
    month: int  # 1-12
    days_tracked: int
    days_closed: int
    adherence_pct: int
    avg_kcal: int
    training_days: int


@dataclass(frozen=True)
class YearReview:
    year: int
    total_days_tracked: int
    days_closed: int
    overall_adherence_pct: int
    weight_start: Optional[float]
    weight_end: Optional[float]
    weight_delta_kg: Optional[float]
    avg_kcal: int
    avg_protein_g: int
    best_streak: int
    training_days_total: int
    months: List[MonthSummary] = field(default_factory=list)


def _day_hits_target(d: YearDayRecord) -> bool:
    if d.target_kcal <= 0:
        return False
    return abs(d.actual_kcal - d.target_kcal) / d.target_kcal <= _ADHERENCE_TOLERANCE


def _best_closed_streak(ordered: List[YearDayRecord]) -> int:
    """Longest run of consecutive `was_closed=True` records in day-order."""
    best = 0
    cur = 0
    for d in ordered:
        if d.was_closed:
            cur += 1
            if cur > best:
                best = cur
        else:
            cur = 0
    return best


def _empty_month(m: int) -> MonthSummary:
    return MonthSummary(
        month=m, days_tracked=0, days_closed=0,
        adherence_pct=0, avg_kcal=0, training_days=0,
    )


def compute_year_review(days: List[YearDayRecord], *, year: int) -> YearReview:
    if year < _MIN_YEAR or year > _MAX_YEAR:
        raise ValueError(f"year must be in [{_MIN_YEAR}, {_MAX_YEAR}], got {year}")

    scoped = [d for d in days if d.day.year == year]
    ordered = sorted(scoped, key=lambda d: d.day)

    if not ordered:
        return YearReview(
            year=year, total_days_tracked=0, days_closed=0,
            overall_adherence_pct=0,
            weight_start=None, weight_end=None, weight_delta_kg=None,
            avg_kcal=0, avg_protein_g=0,
            best_streak=0, training_days_total=0,
            months=[_empty_month(m) for m in range(1, 13)],
        )

    closed = [d for d in ordered if d.was_closed]
    hits = sum(1 for d in closed if _day_hits_target(d))
    adherence = round(100 * hits / len(closed)) if closed else 0

    avg_kcal = round(sum(d.actual_kcal for d in closed) / len(closed)) if closed else 0
    avg_protein_g = round(sum(d.protein_g for d in closed) / len(closed)) if closed else 0

    training_days_total = sum(1 for d in ordered if d.had_training)
    best_streak = _best_closed_streak(ordered)

    weights = [d.weight_kg for d in ordered if d.weight_kg is not None]
    weight_start = weights[0] if weights else None
    weight_end = weights[-1] if weights else None
    weight_delta_kg = (
        round(weight_end - weight_start, 2)
        if weight_start is not None and weight_end is not None
        else None
    )

    months: List[MonthSummary] = []
    for m in range(1, 13):
        in_month = [d for d in ordered if d.day.month == m]
        in_closed = [d for d in in_month if d.was_closed]
        m_hits = sum(1 for d in in_closed if _day_hits_target(d))
        months.append(MonthSummary(
            month=m,
            days_tracked=len(in_month),
            days_closed=len(in_closed),
            adherence_pct=round(100 * m_hits / len(in_closed)) if in_closed else 0,
            avg_kcal=round(sum(d.actual_kcal for d in in_closed) / len(in_closed))
                if in_closed else 0,
            training_days=sum(1 for d in in_month if d.had_training),
        ))

    return YearReview(
        year=year,
        total_days_tracked=len(ordered),
        days_closed=len(closed),
        overall_adherence_pct=adherence,
        weight_start=weight_start,
        weight_end=weight_end,
        weight_delta_kg=weight_delta_kg,
        avg_kcal=avg_kcal,
        avg_protein_g=avg_protein_g,
        best_streak=best_streak,
        training_days_total=training_days_total,
        months=months,
    )
