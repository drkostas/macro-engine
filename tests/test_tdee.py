"""Tests for TDEE and macro target computation."""

from macro_engine.tdee import (
    compute_macro_targets,
    compute_step_calories,
    compute_exercise_calories,
    compute_deficit_from_goal,
    bootstrap_tdee_base,
    MAX_DEFICIT,
    REDS_FLOOR,
)


class TestComputeMacroTargets:
    def test_basic_cut(self):
        r = compute_macro_targets(tdee=2600, deficit=800, weight_kg=75)
        assert r["calories"] == 1800
        assert r["protein"] == 165  # 75 * 2.2
        assert r["fat"] == 60  # 75 * 0.8
        assert r["carbs"] > 0  # remainder
        # Verify macro-calorie match
        calc_cal = r["protein"] * 4 + r["carbs"] * 4 + r["fat"] * 9
        assert abs(calc_cal - r["calories"]) <= 4  # rounding tolerance

    def test_deficit_capped(self):
        r = compute_macro_targets(tdee=2600, deficit=2000, weight_kg=75)
        # Deficit should be capped at MAX_DEFICIT
        assert r["calories"] == 2600 - MAX_DEFICIT

    def test_reds_floor(self):
        r = compute_macro_targets(tdee=2000, deficit=1200, weight_kg=60, ffm_kg=50)
        assert r["calories"] >= REDS_FLOOR * 50

    def test_zero_deficit(self):
        r = compute_macro_targets(tdee=2600, deficit=0, weight_kg=75)
        assert r["calories"] == 2600

    def test_custom_protein_fat(self):
        r = compute_macro_targets(tdee=2600, deficit=500, weight_kg=80,
                                   protein_g_per_kg=1.8, fat_g_per_kg=1.0)
        assert r["protein"] == 144  # 80 * 1.8
        assert r["fat"] == 80  # 80 * 1.0


class TestComputeStepCalories:
    def test_10k_steps(self):
        cal = compute_step_calories(10000, 75)
        assert 250 < cal < 400

    def test_zero_steps(self):
        assert compute_step_calories(0, 80) == 0.0

    def test_negative_steps(self):
        assert compute_step_calories(-100, 80) == 0.0


class TestComputeExerciseCalories:
    def test_with_gym(self):
        cal = compute_exercise_calories(
            workout_steps=None, weight_kg=75, age=30, sex="male",
            has_gym=True, gym_duration_min=60,
        )
        assert cal > 300  # 60 min * 6 kcal/min * 1.10

    def test_distance_fallback(self):
        cal = compute_exercise_calories(
            workout_steps=None, weight_kg=75, age=30, sex="male",
            run_distance_km=10,
        )
        assert cal == 750  # 10 km * 1.0 * 75 kg

    def test_empty_no_gym(self):
        assert compute_exercise_calories(None, 75, 30, "male") == 0.0


class TestComputeDeficitFromGoal:
    def test_normal_cut(self):
        from datetime import date
        r = compute_deficit_from_goal(
            weight_kg=80, current_bf_pct=20, target_bf_pct=15,
            target_date=date(2026, 12, 31), today=date(2026, 1, 1),
        )
        assert r["daily_deficit"] > 0
        assert r["fat_to_lose_kg"] > 0
        assert r["safety"] in ("green", "yellow", "red")

    def test_already_at_goal(self):
        from datetime import date
        r = compute_deficit_from_goal(
            weight_kg=70, current_bf_pct=12, target_bf_pct=15,
            target_date=date(2026, 6, 1), today=date(2026, 1, 1),
        )
        assert r["daily_deficit"] == 0


class TestCarbPeriodization:
    """Carb periodization: training_day_type should drive carb targets."""

    def test_rest_day_lower_carbs(self):
        # Need enough calories for both day types to avoid fat floor
        rest = compute_macro_targets(
            tdee=2800, deficit=200, weight_kg=80,
            training_day_type="rest", carb_periodization=True,
        )
        hard = compute_macro_targets(
            tdee=2800, deficit=200, weight_kg=80,
            training_day_type="hard_run", carb_periodization=True,
        )
        assert rest["carbs"] < hard["carbs"]

    def test_rest_day_carbs_match_target(self):
        result = compute_macro_targets(
            tdee=2800, deficit=200, weight_kg=80,
            training_day_type="rest", carb_periodization=True,
        )
        # 3.0 g/kg * 80 kg = 240g
        assert abs(result["carbs"] - 240) <= 5

    def test_hard_run_carbs_match_target(self):
        result = compute_macro_targets(
            tdee=2800, deficit=200, weight_kg=80,
            training_day_type="hard_run", carb_periodization=True,
        )
        # 4.25 g/kg * 80 kg = 340g
        assert abs(result["carbs"] - 340) <= 5

    def test_fat_floor_prevents_negative(self):
        result = compute_macro_targets(
            tdee=1800, deficit=400, weight_kg=80,
            training_day_type="long_run", carb_periodization=True,
        )
        assert result["fat"] >= 48  # 0.6 g/kg * 80

    def test_periodization_off_by_default(self):
        with_flag = compute_macro_targets(
            tdee=2800, deficit=200, weight_kg=80,
            training_day_type="rest", carb_periodization=True,
        )
        without_flag = compute_macro_targets(
            tdee=2800, deficit=200, weight_kg=80,
            training_day_type="rest", carb_periodization=False,
        )
        assert with_flag["carbs"] != without_flag["carbs"]

    def test_unknown_day_type_falls_back(self):
        result = compute_macro_targets(
            tdee=2800, deficit=200, weight_kg=80,
            training_day_type="unknown_type", carb_periodization=True,
        )
        fallback = compute_macro_targets(
            tdee=2800, deficit=200, weight_kg=80,
            training_day_type="rest", carb_periodization=False,
        )
        assert result["carbs"] == fallback["carbs"]

    def test_calories_still_balance(self):
        result = compute_macro_targets(
            tdee=2800, deficit=200, weight_kg=80,
            training_day_type="hard_run", carb_periodization=True,
        )
        total = result["protein"] * 4 + result["carbs"] * 4 + result["fat"] * 9
        assert abs(total - 2600) <= 10  # tdee 2800 - deficit 200 = 2600


class TestBootstrapTdee:
    def test_base_equals_bmr(self):
        assert bootstrap_tdee_base(1800) == 1800
