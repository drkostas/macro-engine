"""macro-engine — nutrition TDEE, macro targets, and meal planning engine.

Public API:
    compute_macro_targets(tdee, deficit, weight_kg, ...) -> dict
    compute_meal_macros(items, ingredients, ...) -> dict
    generate_daily_plan(tdee, deficit, weight_kg, ...) -> dict
    compute_drink_entry(drink_type, quantity) -> dict
    compute_step_calories(step_goal, weight_kg) -> float
    compute_exercise_calories(workout_steps, weight_kg, age, sex, ...) -> float
    compute_deficit_from_goal(weight_kg, current_bf_pct, ...) -> dict
"""

from macro_engine.tdee import (
    CARB_TARGETS_G_PER_KG,
    compute_macro_targets,
    compute_step_calories,
    compute_exercise_calories,
    compute_deficit_from_goal,
    bootstrap_tdee_base,
)
from macro_engine.calculator import compute_meal_macros, compute_preset_totals
from macro_engine.daily_plan import (
    generate_daily_plan,
    classify_sleep_quality,
    adjust_deficit_for_sleep,
    compute_slot_targets,
    redistribute_remaining,
)
from macro_engine.alcohol import (
    compute_drink_entry,
    compute_alcohol_displacement,
    fat_oxidation_pause_hours,
)

__version__ = "0.1.0"
