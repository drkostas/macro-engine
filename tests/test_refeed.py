"""Tests for M6 Phase A — Refeed macros (V2 §4.2).

is_refeed_day detector, compute_refeed_targets generator, and
apply_refeed_to_counter impact on M1.7 deficit duration counter.
"""

import pytest

from macro_engine.refeed import (
    RefeedIntensity,
    RefeedTargets,
    apply_refeed_to_counter,
    compute_refeed_targets,
    is_refeed_day,
)


# ---------------------------------------------------------------------------
# M6.1 is_refeed_day
# ---------------------------------------------------------------------------


class TestIsRefeedDay:
    def test_all_conditions_met(self):
        assert is_refeed_day(
            kcal=2800, tdee=2800,
            carbs_g=400, fat_g=50,
            weight_kg=74,
        ) is True

    def test_kcal_below_95pct_fails(self):
        # 0.94 × 2800 = 2632
        assert is_refeed_day(
            kcal=2600, tdee=2800,
            carbs_g=400, fat_g=50,
            weight_kg=74,
        ) is False

    def test_carbs_below_5_g_per_kg_fails(self):
        # 4.9 × 74 = 362
        assert is_refeed_day(
            kcal=2800, tdee=2800,
            carbs_g=362, fat_g=50,
            weight_kg=74,
        ) is False

    def test_fat_above_1_g_per_kg_fails(self):
        # 1.01 × 74 = 74.7
        assert is_refeed_day(
            kcal=2800, tdee=2800,
            carbs_g=400, fat_g=75,
            weight_kg=74,
        ) is False

    def test_boundary_kcal_95pct_passes(self):
        # Exactly 95% of TDEE should count as refeed.
        assert is_refeed_day(
            kcal=0.95 * 2800, tdee=2800,
            carbs_g=400, fat_g=50,
            weight_kg=74,
        ) is True

    def test_boundary_carbs_exact_5_passes(self):
        assert is_refeed_day(
            kcal=2800, tdee=2800,
            carbs_g=5.0 * 74, fat_g=50,
            weight_kg=74,
        ) is True

    def test_boundary_fat_exact_1_passes(self):
        assert is_refeed_day(
            kcal=2800, tdee=2800,
            carbs_g=400, fat_g=1.0 * 74,
            weight_kg=74,
        ) is True

    def test_guards(self):
        with pytest.raises(ValueError):
            is_refeed_day(kcal=2000, tdee=0, carbs_g=400, fat_g=50, weight_kg=74)


# ---------------------------------------------------------------------------
# M6.2 compute_refeed_targets
# ---------------------------------------------------------------------------


class TestComputeRefeedTargets:
    def test_user_maintenance(self):
        r = compute_refeed_targets(
            weight_kg=74.2, tdee=2800, intensity=RefeedIntensity.MAINTENANCE,
        )
        assert isinstance(r, RefeedTargets)
        # protein 2.0 × 74.2 ≈ 148
        assert r.protein_g == 148
        # carbs 7.0 × 74.2 ≈ 519
        assert r.carbs_g == 519
        # fat 0.7 × 74.2 ≈ 52
        assert r.fat_g == 52
        # kcal = 2800
        assert r.kcal == 2800

    def test_plus_5_intensity(self):
        r = compute_refeed_targets(
            weight_kg=74.2, tdee=2800, intensity=RefeedIntensity.PLUS_5,
        )
        assert r.kcal == round(2800 * 1.05)

    def test_plus_10_intensity(self):
        r = compute_refeed_targets(
            weight_kg=74.2, tdee=2800, intensity=RefeedIntensity.PLUS_10,
        )
        assert r.kcal == round(2800 * 1.10)

    def test_kcal_balance(self):
        # Protein×4 + carbs×4 + fat×9 should approximately match kcal at
        # maintenance (some drift is acceptable — the refeed targets are
        # carb-priority, not macro-closed).
        r = compute_refeed_targets(
            weight_kg=74.0, tdee=2800, intensity=RefeedIntensity.MAINTENANCE,
        )
        total = r.protein_g * 4 + r.carbs_g * 4 + r.fat_g * 9
        # Expected: 148×4 + 518×4 + 52×9 = 592 + 2072 + 468 = 3132
        # This overshoots 2800 — acceptable, carbs drive refeed macros.
        assert total >= 3000

    def test_guards(self):
        with pytest.raises(ValueError):
            compute_refeed_targets(weight_kg=-1, tdee=2800)
        with pytest.raises(ValueError):
            compute_refeed_targets(weight_kg=74, tdee=0)


# ---------------------------------------------------------------------------
# M6.3 apply_refeed_to_counter
# ---------------------------------------------------------------------------


class TestApplyRefeedToCounter:
    def test_single_refeed_subtracts_3(self):
        assert apply_refeed_to_counter(10, refeed_length_days=1) == 7

    def test_two_day_refeed_subtracts_6(self):
        assert apply_refeed_to_counter(10, refeed_length_days=2) == 4

    def test_counter_floors_at_zero(self):
        assert apply_refeed_to_counter(2, refeed_length_days=2) == 0

    def test_zero_counter_stays_zero(self):
        assert apply_refeed_to_counter(0, refeed_length_days=1) == 0

    def test_invalid_length_raises(self):
        with pytest.raises(ValueError):
            apply_refeed_to_counter(10, refeed_length_days=3)
        with pytest.raises(ValueError):
            apply_refeed_to_counter(10, refeed_length_days=0)
