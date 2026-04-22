"""Creatine-water offset correction (M3.3).

Research basis: V2 §8.4. Creatine monohydrate supplementation adds
intracellular water ~proportional to FFM. The offset inflates measured
weight and distorts BIA composition readings, so callers subtract this
from measured weight before running Forbes partitioning or weigh-in logic.

Kinetics:
- Loading (≥15 g/day): τ=2d → ~98% by day 7
- Non-loading (3-5 g/day, typical maintenance): τ=8d → ~98% by day 28
- De-loading (after stop_date): τ=14d → ~98% cleared by 6 weeks

Null start_date + positive dose is interpreted as "historical use, fully
saturated" — callers who opt into creatine but don't know when they started
still get a correct correction.
"""

from __future__ import annotations

import math
from datetime import date


# W_max = fraction × FFM (V2 §8.4)
_W_MAX_FRACTION: float = 0.0155

# Time constants in days.
_TAU_LOADING_D: float = 2.0
_TAU_NON_LOADING_D: float = 8.0
_TAU_DELOAD_D: float = 14.0

# Loading dose threshold (inclusive) — ≥15 g/day counts as a loading protocol.
_LOADING_DOSE_THRESHOLD_G: float = 15.0

# BIA body-water fraction. Dividing the creatine offset by this gives the
# correction to apply to BIA-reported lean mass.
_BIA_BODY_WATER_FRACTION: float = 0.73


def creatine_water_adjustment(
    ffm_kg: float,
    *,
    dose_g_per_day: float,
    start_date: date | None,
    today: date,
    stop_date: date | None = None,
) -> float:
    """Return the creatine-water offset in kg to subtract from measured weight."""
    if ffm_kg < 0:
        raise ValueError(f"ffm_kg must be non-negative, got {ffm_kg}")
    if dose_g_per_day < 0:
        raise ValueError(f"dose_g_per_day must be non-negative, got {dose_g_per_day}")
    if dose_g_per_day == 0:
        return 0.0

    w_max = _W_MAX_FRACTION * ffm_kg

    # Historical-use fallback: dose but no start date → assume saturated.
    if start_date is None:
        current_offset = w_max
    else:
        days_on = (today - start_date).days
        if days_on <= 0:
            # Start date is today or future — no saturation yet.
            return 0.0
        tau = _TAU_LOADING_D if dose_g_per_day >= _LOADING_DOSE_THRESHOLD_G else _TAU_NON_LOADING_D
        current_offset = w_max * (1.0 - math.exp(-days_on / tau))

    # De-loading decay after stop_date.
    if stop_date is not None and stop_date <= today:
        days_off = (today - stop_date).days
        if days_off > 0:
            current_offset *= math.exp(-days_off / _TAU_DELOAD_D)

    return current_offset


def bia_creatine_correction(offset_kg: float) -> float:
    """Convert a creatine-water offset (kg) into a BIA lean-mass correction.

    BIA estimates lean mass from total body water assuming water is ~73% of
    lean. The creatine-driven water rise biases that estimate, so dividing
    by 0.73 recovers the equivalent lean-mass overestimate.
    """
    return offset_kg / _BIA_BODY_WATER_FRACTION
