"""Tests for measurement method sigma anchors + staleness CI widening (M3.2).

Research basis: V2 §8.2 anchor table.

Base sigmas:
    DEXA      ±1.0 kg
    Caliper   ±2.0 kg
    Navy tape ±2.2 kg
    BIA       ±2.5 kg
    NHANES    ±3.0 kg

Staleness: sigma grows linearly past 12 weeks at +0.1 kg/wk.
"""

import pytest

from macro_engine.method_sigma import (
    Method,
    effective_sigma_kg,
    method_sigma_kg,
)


class TestMethodEnum:
    def test_has_five_members(self):
        assert len(Method) == 5

    def test_string_values(self):
        assert Method.DEXA.value == "dexa"
        assert Method.CALIPER.value == "caliper"
        assert Method.NAVY_TAPE.value == "navy"
        assert Method.BIA.value == "bia"
        assert Method.NHANES.value == "nhanes"


class TestBaseSigmas:
    @pytest.mark.parametrize(
        "method,expected",
        [
            (Method.DEXA, 1.0),
            (Method.CALIPER, 2.0),
            (Method.NAVY_TAPE, 2.2),
            (Method.BIA, 2.5),
            (Method.NHANES, 3.0),
        ],
    )
    def test_lookup(self, method: Method, expected: float):
        assert method_sigma_kg(method) == pytest.approx(expected)


class TestEffectiveSigmaStaleness:
    def test_fresh_measurement_returns_base(self):
        assert effective_sigma_kg(Method.DEXA, weeks_since=0.0) == pytest.approx(1.0)

    def test_at_12_weeks_still_base(self):
        assert effective_sigma_kg(Method.BIA, weeks_since=12.0) == pytest.approx(2.5)

    def test_24_weeks_adds_1_2_kg(self):
        # 12 extra weeks × 0.1 kg/wk = 1.2 kg
        assert effective_sigma_kg(Method.NAVY_TAPE, weeks_since=24.0) == pytest.approx(
            2.2 + 1.2
        )

    def test_36_weeks_adds_2_4_kg(self):
        assert effective_sigma_kg(Method.DEXA, weeks_since=36.0) == pytest.approx(
            1.0 + 2.4
        )

    def test_partial_week_scales_linearly(self):
        # 18 weeks = 6 beyond threshold = +0.6 kg
        assert effective_sigma_kg(Method.NHANES, weeks_since=18.0) == pytest.approx(
            3.0 + 0.6
        )

    def test_negative_weeks_treated_as_fresh(self):
        # Robustness: if a caller passes a slightly-future date, don't widen.
        assert effective_sigma_kg(Method.DEXA, weeks_since=-2.0) == pytest.approx(1.0)


class TestAllMethodsCovered:
    @pytest.mark.parametrize("method", list(Method))
    def test_every_method_has_sigma(self, method: Method):
        assert method_sigma_kg(method) > 0
        assert effective_sigma_kg(method, weeks_since=0.0) > 0
