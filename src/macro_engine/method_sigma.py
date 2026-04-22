"""Measurement method uncertainty sigmas + staleness widening (M3.2).

Research basis: V2 §8.2 anchor table. Each method has a canonical sigma.
Past 12 weeks, sigma widens linearly at 0.1 kg/wk so the CI reflects
ongoing uncertainty about the user's current composition.

Policy (not implemented here — left to the caller):
- Most-recent-wins when multiple anchors are present. Don't blend.
"""

from __future__ import annotations

from enum import Enum


class Method(str, Enum):
    DEXA = "dexa"
    CALIPER = "caliper"
    NAVY_TAPE = "navy"
    BIA = "bia"
    NHANES = "nhanes"


_BASE_SIGMA_KG: dict[Method, float] = {
    Method.DEXA: 1.0,
    Method.CALIPER: 2.0,
    Method.NAVY_TAPE: 2.2,
    Method.BIA: 2.5,
    Method.NHANES: 3.0,
}


# Staleness: past this threshold sigma widens.
_STALENESS_THRESHOLD_WEEKS: float = 12.0
_STALENESS_RATE_KG_PER_WEEK: float = 0.1


def method_sigma_kg(method: Method) -> float:
    """Return the canonical sigma for a freshly-taken measurement."""
    return _BASE_SIGMA_KG[method]


def effective_sigma_kg(method: Method, weeks_since: float) -> float:
    """Return the CI sigma adjusted for staleness of the most recent anchor.

    A measurement ≤12 weeks old keeps its base sigma. Beyond 12 weeks the
    sigma grows linearly at 0.1 kg/wk to reflect mounting uncertainty.
    Negative values (future-dated or clock skew) are treated as fresh.
    """
    base = method_sigma_kg(method)
    if weeks_since <= _STALENESS_THRESHOLD_WEEKS:
        return base
    extra_weeks = weeks_since - _STALENESS_THRESHOLD_WEEKS
    return base + extra_weeks * _STALENESS_RATE_KG_PER_WEEK
