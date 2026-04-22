"""M8 Phase A — Hydration core (V2 §11).

Pure-logic water and sodium targets:
- Water: 28 mL/kg for beverages, 35 mL/kg total including food
- Sodium: 1500 mg baseline; athletic additive of 950 mg per L of sweat
- Hyponatremia rail: flag excess water without sodium over a sustained period
- Alcohol + caffeine corrections per Maughan 2003 / 2016
"""

from __future__ import annotations

from dataclasses import dataclass


# ---------------------------------------------------------------------------
# M8.1 Water target
# ---------------------------------------------------------------------------

_WATER_BEVERAGE_ML_PER_KG: float = 28.0
_WATER_TOTAL_ML_PER_KG: float = 35.0


@dataclass(frozen=True)
class WaterTargets:
    beverage_ml: int
    total_ml: int


def compute_water_target(weight_kg: float) -> WaterTargets:
    """Return beverage-only and total (incl food) water targets in mL."""
    if weight_kg <= 0:
        raise ValueError(f"weight_kg must be positive, got {weight_kg}")
    return WaterTargets(
        beverage_ml=round(_WATER_BEVERAGE_ML_PER_KG * weight_kg),
        total_ml=round(_WATER_TOTAL_ML_PER_KG * weight_kg),
    )


# ---------------------------------------------------------------------------
# M8.2 Sodium target
# ---------------------------------------------------------------------------

_SODIUM_REST_FLOOR_MG: int = 1500
_SODIUM_REST_CEILING_MG: int = 2300
_SODIUM_ATHLETIC_PER_L_SWEAT: int = 950


def compute_sodium_target(
    *,
    sweat_l: float = 0.0,
    manual_rest_mg: int | None = None,
) -> int:
    """Compute daily sodium target in mg.

    At rest (sweat_l == 0): baseline 1500 mg, capped at 2300 mg ceiling.
    Athletic (sweat_l > 0): 1500 + 950 × sweat_l, bypassing the rest ceiling
    per V6 training-day additive rules.
    """
    if sweat_l < 0:
        raise ValueError(f"sweat_l must be non-negative, got {sweat_l}")

    if sweat_l == 0:
        base = manual_rest_mg if manual_rest_mg is not None else _SODIUM_REST_FLOOR_MG
        return min(max(_SODIUM_REST_FLOOR_MG, base), _SODIUM_REST_CEILING_MG)

    return _SODIUM_REST_FLOOR_MG + round(_SODIUM_ATHLETIC_PER_L_SWEAT * sweat_l)


# ---------------------------------------------------------------------------
# M8.3 Hyponatremia rail
# ---------------------------------------------------------------------------

_HYPONATREMIA_WATER_FLOW_THRESHOLD_ML_PER_HR: int = 1000
_HYPONATREMIA_MIN_HOURS: int = 3
_HYPONATREMIA_SODIUM_THRESHOLD_MG_PER_HR: int = 200


def is_hyponatremia_risk(
    *,
    water_ml_per_hour: float,
    hours: int,
    sodium_mg_per_hour: float,
) -> bool:
    """Flag exercise-associated hyponatremia risk (V2 §11.2)."""
    return (
        water_ml_per_hour >= _HYPONATREMIA_WATER_FLOW_THRESHOLD_ML_PER_HR
        and hours >= _HYPONATREMIA_MIN_HOURS
        and sodium_mg_per_hour < _HYPONATREMIA_SODIUM_THRESHOLD_MG_PER_HR
    )


# ---------------------------------------------------------------------------
# M8.4 Alcohol + caffeine effective hydration
# ---------------------------------------------------------------------------

_ETHANOL_ML_PENALTY_PER_G: int = 10
_CAFFEINE_THRESHOLD_MG: int = 500
_CAFFEINE_EXCESS_DIURETIC_ML_PER_MG: float = 0.5


def effective_hydration(
    volume_ml: float,
    *,
    ethanol_g: float,
    caffeine_mg: float,
) -> int:
    """Adjust a beverage volume for diuretic effects.

    Maughan 2003/2016: caffeine up to 500 mg/day has no net diuretic effect
    and the beverage's full volume counts. Above 500 mg, the excess pulls
    ~0.5 mL per mg. Alcohol per V2 §11.5: -10 mL per g ethanol (AVP
    suppression). Result floors at 0.
    """
    effective = volume_ml - _ETHANOL_ML_PENALTY_PER_G * ethanol_g
    if caffeine_mg > _CAFFEINE_THRESHOLD_MG:
        excess = caffeine_mg - _CAFFEINE_THRESHOLD_MG
        effective -= excess * _CAFFEINE_EXCESS_DIURETIC_ML_PER_MG
    return max(0, round(effective))
