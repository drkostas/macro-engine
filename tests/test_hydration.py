"""Tests for M8 Phase A — Hydration core (V2 §11)."""

import pytest

from macro_engine.hydration import (
    WaterTargets,
    compute_sodium_target,
    compute_water_target,
    effective_hydration,
    is_hyponatremia_risk,
)


# ---------------------------------------------------------------------------
# M8.1 Water target
# ---------------------------------------------------------------------------


class TestWaterTarget:
    def test_user_profile(self):
        r = compute_water_target(weight_kg=74.2)
        assert isinstance(r, WaterTargets)
        assert r.beverage_ml == 2078  # 28 × 74.2 = 2077.6
        assert r.total_ml == 2597     # 35 × 74.2 = 2597

    def test_60kg(self):
        r = compute_water_target(weight_kg=60)
        assert r.beverage_ml == 1680
        assert r.total_ml == 2100

    def test_scales_linearly(self):
        a = compute_water_target(weight_kg=50)
        b = compute_water_target(weight_kg=100)
        assert b.beverage_ml == a.beverage_ml * 2

    def test_negative_raises(self):
        with pytest.raises(ValueError):
            compute_water_target(weight_kg=-1)

    def test_zero_raises(self):
        with pytest.raises(ValueError):
            compute_water_target(weight_kg=0)


# ---------------------------------------------------------------------------
# M8.2 Sodium target
# ---------------------------------------------------------------------------


class TestSodiumTarget:
    def test_rest_baseline(self):
        assert compute_sodium_target(sweat_l=0) == 1500

    def test_rest_ceiling(self):
        # Rest ceiling caps at 2300
        assert compute_sodium_target(sweat_l=0, manual_rest_mg=3000) == 2300

    def test_athletic_additive(self):
        assert compute_sodium_target(sweat_l=1.0) == 1500 + 950

    def test_heavy_sweat(self):
        # 1.5 L sweat → 1500 + 1425 = 2925
        assert compute_sodium_target(sweat_l=1.5) == 2925

    def test_athletic_bypasses_rest_ceiling(self):
        # 2.0 L sweat → 1500 + 1900 = 3400 > rest ceiling, but valid for training day
        assert compute_sodium_target(sweat_l=2.0) == 3400

    def test_negative_sweat_raises(self):
        with pytest.raises(ValueError):
            compute_sodium_target(sweat_l=-0.5)


# ---------------------------------------------------------------------------
# M8.3 Hyponatremia flag
# ---------------------------------------------------------------------------


class TestHyponatremia:
    def test_high_water_no_sodium_long_duration(self):
        assert is_hyponatremia_risk(
            water_ml_per_hour=1200, hours=4, sodium_mg_per_hour=0,
        ) is True

    def test_short_duration_no_flag(self):
        # 2 hours doesn't meet the 3-hour threshold
        assert is_hyponatremia_risk(
            water_ml_per_hour=1200, hours=2, sodium_mg_per_hour=0,
        ) is False

    def test_adequate_sodium_no_flag(self):
        assert is_hyponatremia_risk(
            water_ml_per_hour=1200, hours=4, sodium_mg_per_hour=300,
        ) is False

    def test_low_flow_no_flag(self):
        assert is_hyponatremia_risk(
            water_ml_per_hour=800, hours=4, sodium_mg_per_hour=0,
        ) is False

    def test_boundary_exactly_1000(self):
        # >= 1000 counts as high flow
        assert is_hyponatremia_risk(
            water_ml_per_hour=1000, hours=3, sodium_mg_per_hour=0,
        ) is True


# ---------------------------------------------------------------------------
# M8.4 Alcohol + caffeine corrections
# ---------------------------------------------------------------------------


class TestEffectiveHydration:
    def test_plain_water(self):
        assert effective_hydration(500, ethanol_g=0, caffeine_mg=0) == 500

    def test_alcohol_penalty(self):
        # 20 g ethanol → -200 mL
        assert effective_hydration(500, ethanol_g=20, caffeine_mg=0) == 300

    def test_caffeine_under_500_full(self):
        assert effective_hydration(500, ethanol_g=0, caffeine_mg=400) == 500

    def test_caffeine_over_500_half(self):
        # 1000 mL with 700 mg caffeine: 200 mg excess × 0.5 = 100 mL diuretic → 900 mL
        # (Maughan 2016: only the excess at >500mg has any diuretic pull, and even then partial)
        assert effective_hydration(1000, ethanol_g=0, caffeine_mg=700) == 900

    def test_combined_alcohol_and_caffeine(self):
        # 500 mL - (20g × 10) = 300; caffeine 400 no effect → 300
        assert effective_hydration(500, ethanol_g=20, caffeine_mg=400) == 300

    def test_floors_at_zero(self):
        # 100 mL with 20 g ethanol would be -100 → 0
        assert effective_hydration(100, ethanol_g=20, caffeine_mg=0) == 0
