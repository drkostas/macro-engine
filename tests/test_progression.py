"""M10 Phase B — 30/60/90-day progression snapshot tests."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from macro_engine.progression import (
    DayRecord,
    compute_progression_window,
)


def _day(
    offset: int,
    *,
    target_kcal: int = 2000,
    actual_kcal: int = 1950,
    weight_kg: float | None = 75.0,
    had_training: bool = False,
    was_closed: bool = True,
    tdee_kcal: float | None = None,
) -> DayRecord:
    return DayRecord(
        day=date(2026, 1, 1) + timedelta(days=offset),
        target_kcal=target_kcal,
        actual_kcal=actual_kcal,
        weight_kg=weight_kg,
        had_training=had_training,
        was_closed=was_closed,
        tdee_kcal=tdee_kcal,
    )


class TestComputeProgressionWindow:
    def test_empty_returns_zeros(self):
        w = compute_progression_window([], weight_kg=75, window_days=30)
        assert w.window_days == 30
        assert w.weight_delta_kg is None
        assert w.adherence_avg_pct == 0
        assert w.avg_daily_deficit == 0
        assert w.training_days == 0
        assert w.days_closed == 0
        assert w.days_total == 0
        assert w.weight_delta_per_week is None

    def test_30_day_weight_delta(self):
        days = [
            _day(i, weight_kg=75.0 - i * 0.04)
            for i in range(30)
        ]
        w = compute_progression_window(days, weight_kg=75, window_days=30)
        # 75.0 → 73.84 = -1.16 kg over 30 days
        assert w.weight_delta_kg == pytest.approx(-1.16, abs=0.02)
        # -1.16 / (30/7) ≈ -0.27 kg/week
        assert w.weight_delta_per_week == pytest.approx(-0.27, abs=0.03)

    def test_adherence_is_closed_day_average(self):
        # 20 closed + 10 open; 15/20 hit target
        hit = [_day(i, actual_kcal=2050) for i in range(15)]
        miss = [_day(i + 15, actual_kcal=3000) for i in range(5)]
        open_ = [_day(i + 20, was_closed=False) for i in range(10)]
        w = compute_progression_window(hit + miss + open_, weight_kg=75, window_days=30)
        assert w.adherence_avg_pct == 75
        assert w.days_closed == 20
        assert w.days_total == 30

    def test_avg_daily_deficit_uses_tdee_minus_intake(self):
        days = [
            _day(i, actual_kcal=2000, tdee_kcal=2500)
            for i in range(7)
        ]
        w = compute_progression_window(days, weight_kg=75, window_days=30)
        assert w.avg_daily_deficit == 500

    def test_avg_daily_deficit_falls_back_to_target_minus_intake(self):
        # No tdee_kcal on records → fall back to target - actual.
        days = [
            _day(i, target_kcal=2500, actual_kcal=2000, tdee_kcal=None)
            for i in range(7)
        ]
        w = compute_progression_window(days, weight_kg=75, window_days=30)
        assert w.avg_daily_deficit == 500

    def test_training_days(self):
        days = [
            _day(i, had_training=(i % 3 == 0))
            for i in range(30)
        ]
        # indices 0,3,6,...27 → 10 training days
        w = compute_progression_window(days, weight_kg=75, window_days=30)
        assert w.training_days == 10

    def test_weight_delta_ignores_missing_weights(self):
        days = [
            _day(0, weight_kg=75.0),
            _day(15, weight_kg=None),
            _day(29, weight_kg=74.0),
        ]
        w = compute_progression_window(days, weight_kg=75, window_days=30)
        assert w.weight_delta_kg == pytest.approx(-1.0, abs=0.01)

    def test_window_days_is_preserved(self):
        w = compute_progression_window([], weight_kg=75, window_days=90)
        assert w.window_days == 90

    def test_invalid_window_raises(self):
        with pytest.raises(ValueError):
            compute_progression_window([], weight_kg=75, window_days=45)
