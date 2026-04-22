"""Tests for M9 Phase A — Injured mode core (V2 §4.5)."""

from datetime import date, timedelta

import pytest

from macro_engine.injured import (
    InjuryNutritionModule,
    InjuryPhase,
    InjuryType,
    classify_injury_phase,
    get_injury_module,
    injured_ea_hard_floor,
    injury_protein_g_per_kg,
)


TODAY = date(2026, 4, 22)


# ---------------------------------------------------------------------------
# M9.1 Injury phase
# ---------------------------------------------------------------------------


class TestInjuryPhase:
    def test_day_0_is_acute(self):
        assert classify_injury_phase(TODAY, TODAY) == InjuryPhase.ACUTE

    def test_day_10_is_acute(self):
        assert classify_injury_phase(TODAY - timedelta(days=10), TODAY) == InjuryPhase.ACUTE

    def test_day_11_is_subacute(self):
        assert classify_injury_phase(TODAY - timedelta(days=11), TODAY) == InjuryPhase.SUBACUTE

    def test_day_42_is_subacute(self):
        assert classify_injury_phase(TODAY - timedelta(days=42), TODAY) == InjuryPhase.SUBACUTE

    def test_day_43_is_chronic(self):
        assert classify_injury_phase(TODAY - timedelta(days=43), TODAY) == InjuryPhase.CHRONIC

    def test_day_90_is_chronic(self):
        assert classify_injury_phase(TODAY - timedelta(days=90), TODAY) == InjuryPhase.CHRONIC

    def test_future_date_raises(self):
        with pytest.raises(ValueError):
            classify_injury_phase(TODAY + timedelta(days=5), TODAY)


# ---------------------------------------------------------------------------
# M9.2 Injury-type protein
# ---------------------------------------------------------------------------


class TestInjuryProtein:
    def test_default_type(self):
        assert injury_protein_g_per_kg(
            InjuryType.DEFAULT, pre_injury_g_per_kg=2.0,
        ) == 2.2

    def test_immobilization(self):
        assert injury_protein_g_per_kg(
            InjuryType.IMMOBILIZATION, pre_injury_g_per_kg=2.0,
        ) == 2.4

    def test_acl(self):
        assert injury_protein_g_per_kg(
            InjuryType.ACL, pre_injury_g_per_kg=2.0,
        ) == 2.4

    def test_severe(self):
        assert injury_protein_g_per_kg(
            InjuryType.SEVERE, pre_injury_g_per_kg=2.0,
        ) == 2.5

    def test_never_below_pre_injury(self):
        # Pre-injury was already high → keep it
        assert injury_protein_g_per_kg(
            InjuryType.DEFAULT, pre_injury_g_per_kg=2.8,
        ) == 2.8

    def test_severe_overrides_pre_injury_when_higher(self):
        assert injury_protein_g_per_kg(
            InjuryType.SEVERE, pre_injury_g_per_kg=2.2,
        ) == 2.5


# ---------------------------------------------------------------------------
# M9.3 Injured EA floor
# ---------------------------------------------------------------------------


class TestInjuredEaFloor:
    def test_ffm_55_rehab_300(self):
        # Cunningham = 500 + 22*55 = 1710
        # 30 × 55 + 300 = 1950
        # max = 1950
        assert injured_ea_hard_floor(ffm_kg=55, rehab_kcal=300) == 1950

    def test_ffm_70_no_rehab(self):
        # Cunningham = 500 + 22*70 = 2040
        # 30 × 70 + 0 = 2100
        # max = 2100
        assert injured_ea_hard_floor(ffm_kg=70, rehab_kcal=0) == 2100

    def test_ffm_45_high_rehab(self):
        # Cunningham = 500 + 22*45 = 1490
        # 30 × 45 + 800 = 2150
        assert injured_ea_hard_floor(ffm_kg=45, rehab_kcal=800) == 2150

    def test_negative_ffm_raises(self):
        with pytest.raises(ValueError):
            injured_ea_hard_floor(ffm_kg=-1, rehab_kcal=0)

    def test_negative_rehab_raises(self):
        with pytest.raises(ValueError):
            injured_ea_hard_floor(ffm_kg=60, rehab_kcal=-1)


# ---------------------------------------------------------------------------
# M9.4 Injury nutrition module
# ---------------------------------------------------------------------------


class TestInjuryModule:
    def test_tendon_gelatin_vit_c(self):
        m = get_injury_module(InjuryType.TENDON)
        assert isinstance(m, InjuryNutritionModule)
        assert "gelatin" in m.supplements
        assert "vitamin C" in m.supplements

    def test_concussion_creatine(self):
        m = get_injury_module(InjuryType.CONCUSSION)
        assert "creatine" in m.supplements

    def test_acl_omega_3(self):
        m = get_injury_module(InjuryType.ACL)
        assert "omega-3" in m.supplements

    def test_bone_ca_d(self):
        m = get_injury_module(InjuryType.BONE)
        assert "calcium" in m.supplements
        assert "vitamin D" in m.supplements

    def test_strain_standard(self):
        m = get_injury_module(InjuryType.STRAIN)
        assert m.label == "Standard recovery"

    def test_default_falls_to_standard(self):
        m = get_injury_module(InjuryType.DEFAULT)
        assert m.label == "Standard recovery"

    def test_every_type_returns_module(self):
        for t in InjuryType:
            m = get_injury_module(t)
            assert isinstance(m, InjuryNutritionModule)
            assert m.label
