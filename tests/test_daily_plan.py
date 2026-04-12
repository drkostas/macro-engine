"""Tests for daily plan generation."""

from macro_engine.daily_plan import (
    classify_sleep_quality,
    adjust_deficit_for_sleep,
    adjust_for_sleep_history,
    generate_daily_plan,
    compute_slot_targets,
    redistribute_remaining,
)


class TestClassifySleepQuality:
    def test_perfect_sleep(self):
        score = classify_sleep_quality(8 * 3600, 1.5 * 3600, 90)
        assert score >= 90

    def test_minimal_sleep(self):
        score = classify_sleep_quality(4 * 3600, 0.3 * 3600, 30)
        assert score < 20

    def test_average_sleep(self):
        score = classify_sleep_quality(7 * 3600, 1.0 * 3600, 70)
        assert 40 < score < 80


class TestAdjustDeficitForSleep:
    def test_normal_sleep(self):
        r = adjust_deficit_for_sleep(800, 75)
        assert r["deficit"] == 800
        assert r["reason"] == "normal"

    def test_mild(self):
        r = adjust_deficit_for_sleep(800, 60)
        assert r["deficit"] == 800  # keeps deficit
        assert r["protein_boost_g"] == 10

    def test_moderate(self):
        r = adjust_deficit_for_sleep(800, 40)
        assert r["deficit"] == 400  # halved
        assert r["reason"] == "sleep_moderate"

    def test_severe(self):
        r = adjust_deficit_for_sleep(800, 20)
        assert r["deficit"] == 0
        assert r["reason"] == "sleep_severe"

    def test_under_5h_always_severe(self):
        r = adjust_deficit_for_sleep(800, 90, total_sleep_hours=4.5)
        assert r["deficit"] == 0


class TestAdjustForSleepHistory:
    def test_no_poor_nights(self):
        base = {"deficit": 800, "reason": "normal", "protein_boost_g": 0, "fiber_boost_g": 0}
        assert adjust_for_sleep_history(0, base) == base

    def test_3_poor_nights_forced_maintenance(self):
        base = {"deficit": 800, "reason": "sleep_mild", "protein_boost_g": 10, "fiber_boost_g": 5}
        r = adjust_for_sleep_history(3, base)
        assert r["deficit"] == 0

    def test_5_poor_nights_diet_break(self):
        base = {"deficit": 800, "reason": "normal", "protein_boost_g": 0, "fiber_boost_g": 0}
        r = adjust_for_sleep_history(5, base)
        assert r["reason"] == "sleep_diet_break_recommended"


class TestGenerateDailyPlan:
    def test_basic_plan(self):
        r = generate_daily_plan(
            tdee=2600, deficit=800, weight_kg=75,
            training_day_type="rest", sleep_quality_score=80,
        )
        assert r["target_calories"] > 0
        assert r["target_protein"] > 0
        assert r["target_carbs"] >= 0
        assert r["target_fat"] > 0
        assert r["adjustment_reason"] == "normal"

    def test_refeed_flag(self):
        r = generate_daily_plan(
            tdee=2600, deficit=800, weight_kg=75,
            training_day_type="rest", sleep_quality_score=80,
            is_refeed=True,
        )
        assert r["is_refeed"] is True


class TestComputeSlotTargets:
    def test_slots_sum_to_daily(self):
        slots = compute_slot_targets(2000, 180, 200, 60, 35)
        total_cal = sum(s["calories"] for s in slots.values())
        # Allow rounding tolerance
        assert abs(total_cal - 2000) <= 4

    def test_all_slots_present(self):
        slots = compute_slot_targets(2000, 180, 200, 60, 35)
        assert set(slots.keys()) == {"breakfast", "lunch", "dinner", "pre_sleep"}

    def test_dinner_largest(self):
        slots = compute_slot_targets(2000, 180, 200, 60, 35)
        assert slots["dinner"]["calories"] > slots["breakfast"]["calories"]


class TestRedistributeRemaining:
    def test_no_meals_eaten(self):
        daily = {"calories": 2000, "protein": 180, "carbs": 200, "fat": 60, "fiber": 35}
        result = redistribute_remaining(daily, {})
        total = sum(s["calories"] for s in result.values())
        assert abs(total - 2000) <= 4

    def test_after_breakfast(self):
        daily = {"calories": 2000, "protein": 180, "carbs": 200, "fat": 60, "fiber": 35}
        eaten = {"breakfast": {"calories": 500, "protein": 40, "carbs": 50, "fat": 15, "fiber": 8}}
        result = redistribute_remaining(daily, eaten)
        assert result["breakfast"] == eaten["breakfast"]
        remaining_cal = sum(s["calories"] for s in result.values()) - 500
        assert abs(remaining_cal - 1500) <= 4
