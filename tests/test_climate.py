"""M9 Phase E — Climate adjustments tests (V2 §4.5 race prep + climate)."""

from __future__ import annotations

import pytest

from macro_engine.climate import (
    Environment,
    climate_adjust,
)


# ---------------------------------------------------------------------------
# Normal
# ---------------------------------------------------------------------------


class TestNormal:
    def test_normal_returns_zero_adjustments(self):
        adj = climate_adjust(Environment.NORMAL, weight_kg=70, sex="M")
        assert adj.extra_fluid_ml == 0
        assert adj.extra_sodium_mg == 0
        assert adj.extra_kcal == 0
        assert adj.extra_carb_g == 0
        assert adj.iron_target_mg is None


# ---------------------------------------------------------------------------
# Altitude
# ---------------------------------------------------------------------------


class TestAltitude:
    def test_altitude_iron_male_10_to_15(self):
        adj = climate_adjust(Environment.ALTITUDE, weight_kg=70, sex="M")
        # Male iron target range midpoint ~12
        assert 10 <= adj.iron_target_mg <= 15

    def test_altitude_iron_female_18(self):
        adj = climate_adjust(Environment.ALTITUDE, weight_kg=60, sex="F")
        assert adj.iron_target_mg == 18

    def test_altitude_fluid_bump_500(self):
        adj = climate_adjust(Environment.ALTITUDE, weight_kg=70, sex="M")
        assert adj.extra_fluid_ml == 500

    def test_altitude_carb_bump_1g_per_kg(self):
        # +1 g/kg carbs → 70 kg → 70 g
        adj = climate_adjust(Environment.ALTITUDE, weight_kg=70, sex="M")
        assert adj.extra_carb_g == 70


# ---------------------------------------------------------------------------
# Heat
# ---------------------------------------------------------------------------


class TestHeat:
    def test_heat_fluid_from_sweat_rate(self):
        # Default 1 L/h * 1 h = 1000 mL
        adj = climate_adjust(
            Environment.HEAT, weight_kg=70, sex="M",
            sweat_l_per_hour=1.0, hours=1.0,
        )
        assert adj.extra_fluid_ml == 1000

    def test_heat_sodium_750mg_per_liter(self):
        # Midpoint of 500-1000 mg/L → 750 mg/L sweat
        adj = climate_adjust(
            Environment.HEAT, weight_kg=70, sex="M",
            sweat_l_per_hour=1.0, hours=2.0,
        )
        # 2L sweat → 1500 mg sodium
        assert adj.extra_sodium_mg == 1500

    def test_heat_high_sweat_rate(self):
        adj = climate_adjust(
            Environment.HEAT, weight_kg=70, sex="M",
            sweat_l_per_hour=1.5, hours=2.0,
        )
        # 3L sweat → 3000 mL fluid + 2250 mg sodium
        assert adj.extra_fluid_ml == 3000
        assert adj.extra_sodium_mg == 2250

    def test_heat_default_sweat_if_unspecified(self):
        # No sweat kwargs → use default 1L/h for 1h
        adj = climate_adjust(Environment.HEAT, weight_kg=70, sex="M")
        assert adj.extra_fluid_ml == 1000
        assert adj.extra_sodium_mg == 750


# ---------------------------------------------------------------------------
# Cold
# ---------------------------------------------------------------------------


class TestCold:
    def test_cold_kcal_bump_10_percent_of_bmr(self):
        # BMR 1800 → +180 kcal
        adj = climate_adjust(
            Environment.COLD, weight_kg=70, sex="M", bmr_kcal=1800,
        )
        assert adj.extra_kcal == 180

    def test_cold_requires_bmr_or_defaults(self):
        # No BMR provided → default Cunningham-ish for 70kg FFM ~1700
        # 10% of ~1700 ~170
        adj = climate_adjust(Environment.COLD, weight_kg=70, sex="M")
        assert adj.extra_kcal > 0
        assert adj.extra_kcal < 300


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


class TestValidation:
    def test_negative_weight_raises(self):
        with pytest.raises(ValueError):
            climate_adjust(Environment.NORMAL, weight_kg=-1, sex="M")

    def test_unknown_sex_raises(self):
        with pytest.raises(ValueError):
            climate_adjust(Environment.ALTITUDE, weight_kg=70, sex="X")

    def test_negative_sweat_rate_raises(self):
        with pytest.raises(ValueError):
            climate_adjust(
                Environment.HEAT, weight_kg=70, sex="M",
                sweat_l_per_hour=-1, hours=1,
            )
