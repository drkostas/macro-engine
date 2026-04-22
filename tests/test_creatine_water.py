"""Tests for creatine water-weight correction (M3.3).

Research basis: V2 §8.4. Creatine monohydrate supplementation raises
intracellular water by a predictable amount proportional to FFM. The offset
can confound weigh-ins, especially after loading.

Rules:
- W_max = 0.0155 × FFM (cap)
- Loading (≥15 g/day): τ=2d, ~98% saturated by day 7
- Non-loading (3-5 g/day): τ=8d, ~98% saturated by day 28
- De-loading (after stop_date): τ=14d, ≥98% cleared by 6 weeks
- Null start_date + positive dose: treat as fully saturated (historical use)
- BIA correction divides by 0.73 (body water is ~73% of lean)
"""

from datetime import date, timedelta

import pytest

from macro_engine.creatine_water import (
    bia_creatine_correction,
    creatine_water_adjustment,
)


TODAY = date(2026, 4, 22)


class TestZeroDose:
    def test_zero_dose_no_offset(self):
        assert creatine_water_adjustment(
            ffm_kg=60.0,
            dose_g_per_day=0.0,
            start_date=TODAY - timedelta(days=30),
            today=TODAY,
        ) == pytest.approx(0.0)


class TestNullStartDate:
    def test_null_start_plus_positive_dose_is_fully_saturated(self):
        # Historical users who don't track a start date but are dosing now.
        offset = creatine_water_adjustment(
            ffm_kg=60.0,
            dose_g_per_day=5.0,
            start_date=None,
            today=TODAY,
        )
        assert offset == pytest.approx(0.0155 * 60.0)  # full W_max


class TestLoadingPhase:
    def test_day_1_partial(self):
        offset = creatine_water_adjustment(
            ffm_kg=60.0,
            dose_g_per_day=20.0,
            start_date=TODAY - timedelta(days=1),
            today=TODAY,
        )
        # Loading, τ=2d, day 1 → 1-e^(-1/2) ≈ 0.393 × W_max(0.93) ≈ 0.37
        assert 0.3 < offset < 0.5

    def test_day_7_mostly_saturated(self):
        offset = creatine_water_adjustment(
            ffm_kg=60.0,
            dose_g_per_day=20.0,
            start_date=TODAY - timedelta(days=7),
            today=TODAY,
        )
        w_max = 0.0155 * 60.0
        # 1 - e^-3.5 ≈ 0.970
        assert offset >= w_max * 0.96

    def test_loading_threshold_is_15g(self):
        # 15 g/day uses loading tau (τ=2d).
        loading = creatine_water_adjustment(
            ffm_kg=60.0,
            dose_g_per_day=15.0,
            start_date=TODAY - timedelta(days=5),
            today=TODAY,
        )
        non_loading = creatine_water_adjustment(
            ffm_kg=60.0,
            dose_g_per_day=14.9,
            start_date=TODAY - timedelta(days=5),
            today=TODAY,
        )
        assert loading > non_loading


class TestNonLoadingPhase:
    def test_day_7_partial(self):
        offset = creatine_water_adjustment(
            ffm_kg=60.0,
            dose_g_per_day=5.0,
            start_date=TODAY - timedelta(days=7),
            today=TODAY,
        )
        w_max = 0.0155 * 60.0
        # Non-loading τ=8d → day 7: 1-e^(-7/8) ≈ 0.583
        assert 0.5 * w_max < offset < 0.7 * w_max

    def test_day_28_mostly_saturated(self):
        offset = creatine_water_adjustment(
            ffm_kg=60.0,
            dose_g_per_day=5.0,
            start_date=TODAY - timedelta(days=28),
            today=TODAY,
        )
        w_max = 0.0155 * 60.0
        # 1 - e^-3.5 ≈ 0.970
        assert offset >= w_max * 0.96


class TestDeloading:
    def test_day_42_after_stop_nearly_cleared(self):
        # Was saturated, stopped 42 days ago.
        offset = creatine_water_adjustment(
            ffm_kg=60.0,
            dose_g_per_day=5.0,
            start_date=TODAY - timedelta(days=90),
            today=TODAY,
            stop_date=TODAY - timedelta(days=42),
        )
        w_max = 0.0155 * 60.0
        # 42 / 14 = 3 half-ish constants → e^-3 ≈ 0.05 remaining
        assert offset < w_max * 0.1

    def test_immediately_after_stop_near_full(self):
        offset = creatine_water_adjustment(
            ffm_kg=60.0,
            dose_g_per_day=5.0,
            start_date=TODAY - timedelta(days=90),
            today=TODAY,
            stop_date=TODAY - timedelta(days=1),
        )
        w_max = 0.0155 * 60.0
        # 1 day with τ=14 → retains ~93%
        assert offset > w_max * 0.85


class TestWmaxScaling:
    def test_ffm_60_wmax(self):
        offset = creatine_water_adjustment(
            ffm_kg=60.0,
            dose_g_per_day=5.0,
            start_date=None,
            today=TODAY,
        )
        assert offset == pytest.approx(0.93)

    def test_ffm_scales_linearly(self):
        a = creatine_water_adjustment(
            ffm_kg=50.0, dose_g_per_day=5.0, start_date=None, today=TODAY,
        )
        b = creatine_water_adjustment(
            ffm_kg=100.0, dose_g_per_day=5.0, start_date=None, today=TODAY,
        )
        assert b == pytest.approx(a * 2.0)


class TestBiaCorrection:
    def test_divides_by_073(self):
        assert bia_creatine_correction(0.73) == pytest.approx(1.0)
        assert bia_creatine_correction(0.0) == pytest.approx(0.0)


class TestGuards:
    def test_negative_dose_raises(self):
        with pytest.raises(ValueError):
            creatine_water_adjustment(
                ffm_kg=60.0,
                dose_g_per_day=-5.0,
                start_date=None,
                today=TODAY,
            )

    def test_negative_ffm_raises(self):
        with pytest.raises(ValueError):
            creatine_water_adjustment(
                ffm_kg=-1.0,
                dose_g_per_day=5.0,
                start_date=None,
                today=TODAY,
            )

    def test_start_after_today_treated_as_no_effect(self):
        # Future start date — no offset yet.
        offset = creatine_water_adjustment(
            ffm_kg=60.0,
            dose_g_per_day=5.0,
            start_date=TODAY + timedelta(days=3),
            today=TODAY,
        )
        assert offset == pytest.approx(0.0)
