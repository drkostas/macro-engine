"""M9 Phase D — Race taper tests (V2 §4.5 race prep)."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from macro_engine.taper import (
    TaperPhase,
    classify_taper_phase,
    taper_carb_g_per_kg,
    taper_protein_g_per_kg,
)


# ---------------------------------------------------------------------------
# M9D.1 Taper phase classifier
# ---------------------------------------------------------------------------


class TestClassifyTaperPhase:
    def test_no_race_date_is_normal(self):
        today = date(2026, 4, 22)
        assert classify_taper_phase(None, today) is TaperPhase.NORMAL

    def test_15_days_out_is_normal(self):
        today = date(2026, 4, 22)
        race = today + timedelta(days=15)
        assert classify_taper_phase(race, today) is TaperPhase.NORMAL

    def test_14_days_out_is_volume_taper(self):
        today = date(2026, 4, 22)
        race = today + timedelta(days=14)
        assert classify_taper_phase(race, today) is TaperPhase.VOLUME_TAPER

    def test_8_days_out_is_volume_taper(self):
        today = date(2026, 4, 22)
        race = today + timedelta(days=8)
        assert classify_taper_phase(race, today) is TaperPhase.VOLUME_TAPER

    def test_7_days_out_is_intensity_taper(self):
        today = date(2026, 4, 22)
        race = today + timedelta(days=7)
        assert classify_taper_phase(race, today) is TaperPhase.INTENSITY_TAPER

    def test_4_days_out_is_intensity_taper(self):
        today = date(2026, 4, 22)
        race = today + timedelta(days=4)
        assert classify_taper_phase(race, today) is TaperPhase.INTENSITY_TAPER

    def test_3_days_out_is_glycogen_loading(self):
        today = date(2026, 4, 22)
        race = today + timedelta(days=3)
        assert classify_taper_phase(race, today) is TaperPhase.GLYCOGEN_LOADING

    def test_1_day_out_is_glycogen_loading(self):
        today = date(2026, 4, 22)
        race = today + timedelta(days=1)
        assert classify_taper_phase(race, today) is TaperPhase.GLYCOGEN_LOADING

    def test_race_day_is_race_day(self):
        today = date(2026, 4, 22)
        assert classify_taper_phase(today, today) is TaperPhase.RACE_DAY

    def test_1_day_post_race_is_recovery(self):
        today = date(2026, 4, 22)
        race = today - timedelta(days=1)
        assert classify_taper_phase(race, today) is TaperPhase.RECOVERY

    def test_7_days_post_race_is_recovery(self):
        today = date(2026, 4, 22)
        race = today - timedelta(days=7)
        assert classify_taper_phase(race, today) is TaperPhase.RECOVERY

    def test_8_days_post_race_is_normal(self):
        today = date(2026, 4, 22)
        race = today - timedelta(days=8)
        assert classify_taper_phase(race, today) is TaperPhase.NORMAL


# ---------------------------------------------------------------------------
# M9D.2 Carb + protein targets by phase
# ---------------------------------------------------------------------------


class TestTaperCarbGPerKg:
    def test_normal_returns_baseline(self):
        assert taper_carb_g_per_kg(TaperPhase.NORMAL, baseline_g_per_kg=5.0) == 5.0

    def test_volume_taper_6(self):
        assert taper_carb_g_per_kg(TaperPhase.VOLUME_TAPER, baseline_g_per_kg=5.0) == 6.0

    def test_intensity_taper_7(self):
        assert taper_carb_g_per_kg(TaperPhase.INTENSITY_TAPER, baseline_g_per_kg=5.0) == 7.0

    def test_glycogen_loading_10(self):
        assert taper_carb_g_per_kg(TaperPhase.GLYCOGEN_LOADING, baseline_g_per_kg=5.0) == 10.0

    def test_race_day_9(self):
        assert taper_carb_g_per_kg(TaperPhase.RACE_DAY, baseline_g_per_kg=5.0) == 9.0

    def test_recovery_7(self):
        assert taper_carb_g_per_kg(TaperPhase.RECOVERY, baseline_g_per_kg=5.0) == 7.0

    def test_never_below_baseline(self):
        # Endurance athlete already on 8 g/kg baseline during normal training.
        assert taper_carb_g_per_kg(TaperPhase.NORMAL, baseline_g_per_kg=8.0) == 8.0
        # Baseline higher than volume_taper target → use baseline.
        assert taper_carb_g_per_kg(TaperPhase.VOLUME_TAPER, baseline_g_per_kg=8.0) == 8.0


class TestTaperProteinGPerKg:
    def test_normal_returns_baseline(self):
        assert taper_protein_g_per_kg(TaperPhase.NORMAL, baseline_g_per_kg=2.0) == 2.0

    def test_floors_at_1_8(self):
        # Baseline lower than floor → use floor.
        assert taper_protein_g_per_kg(TaperPhase.VOLUME_TAPER, baseline_g_per_kg=1.5) == 1.8

    def test_never_below_baseline(self):
        assert taper_protein_g_per_kg(TaperPhase.RACE_DAY, baseline_g_per_kg=2.5) == 2.5

    def test_all_phases_respect_floor(self):
        for phase in TaperPhase:
            assert taper_protein_g_per_kg(phase, baseline_g_per_kg=1.0) >= 1.8


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


class TestValidation:
    def test_negative_baseline_raises(self):
        with pytest.raises(ValueError):
            taper_carb_g_per_kg(TaperPhase.NORMAL, baseline_g_per_kg=-1)
        with pytest.raises(ValueError):
            taper_protein_g_per_kg(TaperPhase.NORMAL, baseline_g_per_kg=-1)
