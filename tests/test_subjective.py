"""Tests for M7 Phase A — Subjective signal scoring (V2 §9 / V3).

M7.1 Hooper 4-item score
M7.2 28-day Hooper Z-score alert
M7.3 Foster session RPE + weekly strain/monotony
M7.4 PHQ-2 + SCOFF screeners
"""

import pytest

from macro_engine.subjective import (
    HooperAlert,
    HooperScore,
    WeeklyStrain,
    compute_hooper_alert,
    compute_hooper_score,
    compute_weekly_strain,
    phq2_score,
    scoff_score,
    session_strain,
)


# ---------------------------------------------------------------------------
# M7.1 Hooper
# ---------------------------------------------------------------------------


class TestHooperScore:
    def test_all_ones_is_good(self):
        r = compute_hooper_score(fatigue=1, sleep=1, stress=1, soreness=1)
        assert isinstance(r, HooperScore)
        assert r.total == 4
        assert r.quality == "good"

    def test_all_sevens_is_poor(self):
        r = compute_hooper_score(fatigue=7, sleep=7, stress=7, soreness=7)
        assert r.total == 28
        assert r.quality == "poor"

    def test_mid_is_moderate(self):
        r = compute_hooper_score(fatigue=4, sleep=4, stress=4, soreness=4)
        assert r.total == 16
        assert r.quality == "moderate"

    def test_boundary_10_good(self):
        # Total 10 = upper bound of good
        r = compute_hooper_score(fatigue=2, sleep=3, stress=2, soreness=3)
        assert r.total == 10
        assert r.quality == "good"

    def test_boundary_11_moderate(self):
        r = compute_hooper_score(fatigue=2, sleep=3, stress=3, soreness=3)
        assert r.total == 11
        assert r.quality == "moderate"

    def test_boundary_17_moderate(self):
        r = compute_hooper_score(fatigue=4, sleep=4, stress=5, soreness=4)
        assert r.total == 17
        assert r.quality == "moderate"

    def test_boundary_18_poor(self):
        r = compute_hooper_score(fatigue=5, sleep=5, stress=4, soreness=4)
        assert r.total == 18
        assert r.quality == "poor"

    def test_out_of_range_raises(self):
        with pytest.raises(ValueError):
            compute_hooper_score(fatigue=0, sleep=4, stress=4, soreness=4)
        with pytest.raises(ValueError):
            compute_hooper_score(fatigue=8, sleep=4, stress=4, soreness=4)


# ---------------------------------------------------------------------------
# M7.2 Hooper Z-score alert
# ---------------------------------------------------------------------------


class TestHooperAlert:
    def test_short_history_normal(self):
        r = compute_hooper_alert(today_total=15, history=[12, 13, 14])
        assert isinstance(r, HooperAlert)
        assert r.alert_level == "normal"
        assert r.z_score == 0.0

    def test_today_matches_mean(self):
        hist = [12] * 28
        r = compute_hooper_alert(today_total=12, history=hist)
        assert abs(r.z_score) < 0.01
        assert r.alert_level == "normal"

    def test_2_sigma_high_alert(self):
        # History mean 12 with std ~2; today 18 → z=3 → high
        hist = [10, 14] * 14  # 28 entries, std=2, mean=12
        r = compute_hooper_alert(today_total=18, history=hist)
        assert r.z_score > 2.0
        assert r.alert_level == "high"

    def test_mild_elevation(self):
        hist = [10, 14] * 14
        r = compute_hooper_alert(today_total=15, history=hist)
        assert 1.0 < r.z_score <= 2.0
        assert r.alert_level == "elevated"

    def test_zero_std_history(self):
        # Flat history: std=0 → return normal (can't compute z)
        hist = [12] * 28
        r = compute_hooper_alert(today_total=20, history=hist)
        assert r.alert_level == "normal"


# ---------------------------------------------------------------------------
# M7.3 Foster RPE + strain
# ---------------------------------------------------------------------------


class TestSessionStrain:
    def test_basic(self):
        assert session_strain(7, 60) == 420

    def test_zero_duration(self):
        assert session_strain(8, 0) == 0

    def test_zero_rpe(self):
        assert session_strain(0, 60) == 0


class TestWeeklyStrain:
    def test_flat_week_high_monotony(self):
        strains = [500] * 7
        r = compute_weekly_strain(strains)
        assert isinstance(r, WeeklyStrain)
        assert r.total == 3500
        # std=0 → monotony clamped to 100
        assert r.monotony == 100

    def test_varied_week_low_monotony(self):
        # Big variance → low monotony
        strains = [100, 900, 200, 800, 300, 700, 400]
        r = compute_weekly_strain(strains)
        assert r.monotony < 5
        assert r.total == sum(strains)

    def test_empty_history(self):
        r = compute_weekly_strain([])
        assert r.total == 0
        assert r.monotony == 0

    def test_strain_formula(self):
        # strain = total × monotony
        strains = [500, 500, 500, 500, 500, 500, 500]
        r = compute_weekly_strain(strains)
        assert r.strain == r.total * r.monotony


# ---------------------------------------------------------------------------
# M7.4 Screeners
# ---------------------------------------------------------------------------


class TestPhq2:
    def test_zero(self):
        score, trigger = phq2_score(0, 0)
        assert score == 0
        assert trigger is False

    def test_threshold_3_triggers_phq9(self):
        score, trigger = phq2_score(2, 1)
        assert score == 3
        assert trigger is True

    def test_below_threshold(self):
        score, trigger = phq2_score(1, 1)
        assert score == 2
        assert trigger is False

    def test_out_of_range_raises(self):
        with pytest.raises(ValueError):
            phq2_score(-1, 0)
        with pytest.raises(ValueError):
            phq2_score(4, 0)


class TestScoff:
    def test_all_false_zero(self):
        score, flag = scoff_score(
            sick_after_full=False, worry_control=False,
            one_stone_3mo=False, fat_when_thin=False, food_dominates=False,
        )
        assert score == 0
        assert flag is False

    def test_one_true_not_flagged(self):
        score, flag = scoff_score(
            sick_after_full=True, worry_control=False,
            one_stone_3mo=False, fat_when_thin=False, food_dominates=False,
        )
        assert score == 1
        assert flag is False

    def test_two_true_flagged(self):
        score, flag = scoff_score(
            sick_after_full=True, worry_control=True,
            one_stone_3mo=False, fat_when_thin=False, food_dominates=False,
        )
        assert score == 2
        assert flag is True

    def test_all_true(self):
        score, flag = scoff_score(
            sick_after_full=True, worry_control=True,
            one_stone_3mo=True, fat_when_thin=True, food_dominates=True,
        )
        assert score == 5
        assert flag is True
