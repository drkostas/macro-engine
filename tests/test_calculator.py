"""Tests for meal macro calculator."""

from macro_engine.calculator import compute_meal_macros, compute_preset_totals

SAMPLE_INGREDIENTS = {
    "oats_dry": {"name": "Oats", "calories_per_100g": 379, "protein_per_100g": 13, "carbs_per_100g": 67.7, "fat_per_100g": 6.5, "fiber_per_100g": 10.1},
    "banana": {"name": "Banana", "calories_per_100g": 89, "protein_per_100g": 1.1, "carbs_per_100g": 22.8, "fat_per_100g": 0.3, "fiber_per_100g": 2.6},
    "honey": {"name": "Honey", "calories_per_100g": 304, "protein_per_100g": 0, "carbs_per_100g": 82.4, "fat_per_100g": 0, "fiber_per_100g": 0.2},
}


class TestComputeMealMacros:
    def test_single_ingredient(self):
        items = [{"ingredient_id": "oats_dry", "grams": 50}]
        r = compute_meal_macros(items, SAMPLE_INGREDIENTS)
        assert abs(r["calories"] - 189.5) < 1
        assert abs(r["protein"] - 6.5) < 0.5
        assert len(r["items"]) == 1

    def test_multiple_ingredients(self):
        items = [
            {"ingredient_id": "oats_dry", "grams": 50},
            {"ingredient_id": "banana", "grams": 118},
            {"ingredient_id": "honey", "grams": 30},
        ]
        r = compute_meal_macros(items, SAMPLE_INGREDIENTS)
        assert r["calories"] > 350
        assert len(r["items"]) == 3

    def test_multiplier(self):
        items = [{"ingredient_id": "oats_dry", "grams": 50}]
        r1 = compute_meal_macros(items, SAMPLE_INGREDIENTS, multiplier=1.0)
        r2 = compute_meal_macros(items, SAMPLE_INGREDIENTS, multiplier=2.0)
        assert abs(r2["calories"] - r1["calories"] * 2) < 1

    def test_empty_items(self):
        r = compute_meal_macros([], SAMPLE_INGREDIENTS)
        assert r["calories"] == 0.0

    def test_unknown_ingredient_raises(self):
        import pytest
        items = [{"ingredient_id": "unicorn_tears", "grams": 100}]
        with pytest.raises(KeyError):
            compute_meal_macros(items, SAMPLE_INGREDIENTS)


class TestComputePresetTotals:
    def test_preset(self):
        presets = {
            "oatmeal": {
                "name": "Basic Oatmeal",
                "items": [
                    {"ingredient_id": "oats_dry", "grams": 50},
                    {"ingredient_id": "honey", "grams": 20},
                ],
            },
        }
        r = compute_preset_totals(presets, SAMPLE_INGREDIENTS)
        assert "oatmeal" in r
        assert r["oatmeal"]["calories"] > 200
