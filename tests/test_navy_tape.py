"""Tests for Navy tape BF% + FFM (M3.6).

Research basis: Hodgdon & Beckett 1984 circumference equations, adopted by
US Navy for body-fat estimation.

Male:   BF% = 86.010 × log10(waist - neck) - 70.041 × log10(height) + 36.76
Female: BF% = 163.205 × log10(waist + hip - neck) - 97.684 × log10(height) - 78.387

All circumferences and height in cm.
"""

import pytest

from macro_engine.navy_tape import navy_tape_bf_pct, navy_tape_ffm_kg


class TestMale:
    def test_known_example(self):
        # 177 cm, 36 cm neck, 82 cm waist → ~15-17% BF
        # Hodgdon/Beckett is calibrated on inches; the cm API converts
        # internally, so this is the actual expected range.
        bf = navy_tape_bf_pct(
            neck_cm=36.0, waist_cm=82.0, height_cm=177.0, sex="male",
        )
        assert 13.0 <= bf <= 18.0

    def test_leaner_user(self):
        # Very narrow waist-neck delta → sub-10% BF
        bf = navy_tape_bf_pct(
            neck_cm=36.0, waist_cm=74.0, height_cm=177.0, sex="male",
        )
        assert bf < 12.0

    def test_heavier_user(self):
        bf = navy_tape_bf_pct(
            neck_cm=40.0, waist_cm=100.0, height_cm=177.0, sex="male",
        )
        assert bf > 24.0


class TestFemale:
    def test_known_example(self):
        # Typical female: 165 cm, 32 cm neck, 72 cm waist, 95 cm hip
        bf = navy_tape_bf_pct(
            neck_cm=32.0, waist_cm=72.0, hip_cm=95.0, height_cm=165.0, sex="female",
        )
        assert 20.0 <= bf <= 32.0

    def test_female_requires_hip(self):
        with pytest.raises(ValueError, match="hip_cm"):
            navy_tape_bf_pct(
                neck_cm=32.0, waist_cm=72.0, height_cm=165.0, sex="female",
            )


class TestFfmDerivation:
    def test_ffm_from_bf(self):
        # 74.2 kg with ~16% BF → FFM ≈ 62.3 kg
        ffm = navy_tape_ffm_kg(
            weight_kg=74.2,
            neck_cm=36.0, waist_cm=82.0, height_cm=177.0, sex="male",
        )
        assert 60.0 <= ffm <= 65.0

    def test_ffm_scales_with_weight(self):
        ffm_lo = navy_tape_ffm_kg(
            weight_kg=60.0,
            neck_cm=36.0, waist_cm=82.0, height_cm=177.0, sex="male",
        )
        ffm_hi = navy_tape_ffm_kg(
            weight_kg=90.0,
            neck_cm=36.0, waist_cm=82.0, height_cm=177.0, sex="male",
        )
        # Same BF% at higher weight → higher FFM (absolute)
        assert ffm_hi > ffm_lo


class TestGuards:
    def test_waist_equal_neck_male_raises(self):
        with pytest.raises(ValueError, match="waist"):
            navy_tape_bf_pct(
                neck_cm=40.0, waist_cm=40.0, height_cm=177.0, sex="male",
            )

    def test_negative_dimension_raises(self):
        with pytest.raises(ValueError):
            navy_tape_bf_pct(
                neck_cm=-1.0, waist_cm=82.0, height_cm=177.0, sex="male",
            )

    def test_waist_plus_hip_eq_neck_female_raises(self):
        with pytest.raises(ValueError):
            navy_tape_bf_pct(
                neck_cm=80.0, waist_cm=40.0, hip_cm=40.0, height_cm=165.0, sex="female",
            )

    def test_unknown_sex_raises(self):
        with pytest.raises(ValueError):
            navy_tape_bf_pct(
                neck_cm=36.0, waist_cm=82.0, height_cm=177.0, sex="other",  # type: ignore[arg-type]
            )


class TestClamp:
    def test_extreme_low_clamped_to_3(self):
        # Artificially low result is clamped to minimum 3%
        bf = navy_tape_bf_pct(
            neck_cm=50.0, waist_cm=51.0, height_cm=200.0, sex="male",
        )
        assert bf >= 3.0

    def test_extreme_high_clamped_to_60(self):
        bf = navy_tape_bf_pct(
            neck_cm=30.0, waist_cm=200.0, height_cm=150.0, sex="male",
        )
        assert bf <= 60.0
