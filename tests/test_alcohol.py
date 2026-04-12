"""Tests for alcohol calorie calculator."""

from macro_engine.alcohol import (
    compute_drink_entry,
    compute_alcohol_displacement,
    fat_oxidation_pause_hours,
)


class TestComputeDrinkEntry:
    def test_known_drink(self):
        r = compute_drink_entry("beer_ipa")
        assert r is not None
        assert r["calories"] > 200
        assert r["alcohol_grams"] > 15
        assert r["carbs"] > 10

    def test_unknown_drink(self):
        assert compute_drink_entry("unicorn_juice") is None

    def test_quantity_scales(self):
        r1 = compute_drink_entry("wine_red", quantity=1)
        r2 = compute_drink_entry("wine_red", quantity=2)
        assert abs(r2["calories"] - r1["calories"] * 2) < 1

    def test_spirit(self):
        r = compute_drink_entry("spirit")
        assert r["carbs"] == 0  # spirits have no carbs
        assert r["alcohol_grams"] > 10


class TestFatOxidationPause:
    def test_zero(self):
        assert fat_oxidation_pause_hours(0) == 0.0

    def test_light_drinking(self):
        h = fat_oxidation_pause_hours(14)
        assert 3.5 < h < 4.5  # ~4 hours for 14g

    def test_moderate_drinking(self):
        h = fat_oxidation_pause_hours(28)
        assert 5.5 < h < 6.5  # ~6 hours for 28g

    def test_heavy_drinking(self):
        h = fat_oxidation_pause_hours(56)
        assert 11 < h < 13  # ~12 hours for 56g

    def test_capped_at_24(self):
        assert fat_oxidation_pause_hours(200) <= 24.0


class TestAlcoholDisplacement:
    def test_basic_displacement(self):
        r = compute_alcohol_displacement(200, remaining_fat_g=50, remaining_carbs_g=100)
        assert r["fat_reduction_g"] > 0
        assert r["carbs_reduction_g"] > 0
        assert r["protein_reduction_g"] == 0  # never from protein

    def test_zero_alcohol(self):
        r = compute_alcohol_displacement(0, 50, 100)
        assert r["fat_reduction_g"] == 0
        assert r["carbs_reduction_g"] == 0

    def test_fat_budget_exceeded(self):
        r = compute_alcohol_displacement(500, remaining_fat_g=5, remaining_carbs_g=200)
        assert r["fat_reduction_g"] <= 5  # capped at remaining
        assert r["carbs_reduction_g"] > 0  # excess shifted to carbs
