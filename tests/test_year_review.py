"""M10 Phase C — Year-in-review aggregator tests."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from macro_engine.year_review import (
    YearDayRecord,
    compute_year_review,
)


def _day(
    year: int,
    offset: int,
    *,
    target_kcal: int = 2000,
    actual_kcal: int = 1950,
    protein_g: float = 140,
    weight_kg: float | None = 75.0,
    had_training: bool = False,
    was_closed: bool = True,
) -> YearDayRecord:
    return YearDayRecord(
        day=date(year, 1, 1) + timedelta(days=offset),
        target_kcal=target_kcal,
        actual_kcal=actual_kcal,
        protein_g=protein_g,
        weight_kg=weight_kg,
        had_training=had_training,
        was_closed=was_closed,
    )


class TestComputeYearReview:
    def test_empty_returns_zeros(self):
        r = compute_year_review([], year=2026)
        assert r.year == 2026
        assert r.total_days_tracked == 0
        assert r.days_closed == 0
        assert r.overall_adherence_pct == 0
        assert r.weight_start is None
        assert r.weight_end is None
        assert r.weight_delta_kg is None
        assert r.avg_kcal == 0
        assert r.avg_protein_g == 0
        assert r.best_streak == 0
        assert r.training_days_total == 0
        assert len(r.months) == 12
        for m in r.months:
            assert m.days_tracked == 0

    def test_year_filter_drops_other_years(self):
        days = [
            _day(2025, 0),  # drop
            _day(2026, 0),  # keep
            _day(2026, 40),  # keep
            _day(2027, 0),  # drop
        ]
        r = compute_year_review(days, year=2026)
        assert r.total_days_tracked == 2

    def test_overall_adherence(self):
        # 10 closed: 8 on target, 2 over
        days = [_day(2026, i, actual_kcal=2050) for i in range(8)] + \
               [_day(2026, i + 8, actual_kcal=3000) for i in range(2)]
        r = compute_year_review(days, year=2026)
        assert r.overall_adherence_pct == 80

    def test_best_streak(self):
        # 3 closed in a row, gap (not closed), 5 closed in a row → best = 5
        days = [_day(2026, i) for i in range(3)] + \
               [_day(2026, 3, was_closed=False)] + \
               [_day(2026, i + 4) for i in range(5)]
        r = compute_year_review(days, year=2026)
        assert r.best_streak == 5

    def test_weight_start_end_delta(self):
        days = [
            _day(2026, 0, weight_kg=80.0),
            _day(2026, 50, weight_kg=78.0),
            _day(2026, 200, weight_kg=75.5),
        ]
        r = compute_year_review(days, year=2026)
        assert r.weight_start == pytest.approx(80.0)
        assert r.weight_end == pytest.approx(75.5)
        assert r.weight_delta_kg == pytest.approx(-4.5, abs=0.01)

    def test_avg_protein(self):
        days = [_day(2026, i, protein_g=150) for i in range(10)]
        r = compute_year_review(days, year=2026)
        assert r.avg_protein_g == 150

    def test_training_days_total(self):
        days = [
            _day(2026, i, had_training=(i % 2 == 0))
            for i in range(20)
        ]
        r = compute_year_review(days, year=2026)
        assert r.training_days_total == 10

    def test_months_are_1_through_12_with_per_month_stats(self):
        # 5 days in Jan, 3 days in Mar
        jan = [_day(2026, i) for i in range(5)]
        mar = [
            YearDayRecord(
                day=date(2026, 3, i + 1),
                target_kcal=2000, actual_kcal=1950, protein_g=140,
                weight_kg=None, had_training=False, was_closed=True,
            ) for i in range(3)
        ]
        r = compute_year_review(jan + mar, year=2026)
        assert len(r.months) == 12
        assert r.months[0].month == 1
        assert r.months[0].days_tracked == 5
        assert r.months[1].month == 2
        assert r.months[1].days_tracked == 0
        assert r.months[2].month == 3
        assert r.months[2].days_tracked == 3

    def test_invalid_year_raises(self):
        with pytest.raises(ValueError):
            compute_year_review([], year=0)
        with pytest.raises(ValueError):
            compute_year_review([], year=10000)
