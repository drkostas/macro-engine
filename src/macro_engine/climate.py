"""M9 Phase E — Climate adjustments (V2 §4.5 race prep + climate).

Four environment buckets:
- normal: no adjustments
- altitude: iron boost (sex-specific), fluid +500 mL, carb +1 g/kg
- heat: sweat-rate driven fluid + sodium
- cold: +10% BMR (thermogenic cost)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from macro_engine.bmr import cunningham


class Environment(str, Enum):
    NORMAL = "normal"
    ALTITUDE = "altitude"
    HEAT = "heat"
    COLD = "cold"


@dataclass(frozen=True)
class ClimateAdjustment:
    extra_fluid_ml: int = 0
    extra_sodium_mg: int = 0
    extra_kcal: int = 0
    extra_carb_g: int = 0
    iron_target_mg: Optional[int] = None
    notes: str = ""


_ALTITUDE_FLUID_BUMP_ML: int = 500
_ALTITUDE_CARB_G_PER_KG: float = 1.0
_ALTITUDE_IRON_MG_FEMALE: int = 18
_ALTITUDE_IRON_MG_MALE: int = 12  # midpoint of 10-15

_HEAT_DEFAULT_SWEAT_L_PER_HOUR: float = 1.0
_HEAT_DEFAULT_HOURS: float = 1.0
_HEAT_SODIUM_MG_PER_L_SWEAT: int = 750  # midpoint of 500-1000

_COLD_KCAL_BUMP_PCT: float = 0.10


def _validate_sex(sex: str) -> str:
    s = sex.upper()
    if s not in ("M", "F"):
        raise ValueError(f"sex must be 'M' or 'F', got {sex!r}")
    return s


def climate_adjust(
    env: Environment,
    *,
    weight_kg: float,
    sex: str,
    sweat_l_per_hour: float = _HEAT_DEFAULT_SWEAT_L_PER_HOUR,
    hours: float = _HEAT_DEFAULT_HOURS,
    bmr_kcal: Optional[float] = None,
) -> ClimateAdjustment:
    """Return per-day climate adjustments for a given environment."""
    if weight_kg < 0:
        raise ValueError(f"weight_kg must be non-negative, got {weight_kg}")
    sex_norm = _validate_sex(sex)
    if sweat_l_per_hour < 0 or hours < 0:
        raise ValueError(
            f"sweat_l_per_hour and hours must be non-negative, got "
            f"{sweat_l_per_hour}, {hours}"
        )

    if env is Environment.NORMAL:
        return ClimateAdjustment()

    if env is Environment.ALTITUDE:
        iron = _ALTITUDE_IRON_MG_FEMALE if sex_norm == "F" else _ALTITUDE_IRON_MG_MALE
        return ClimateAdjustment(
            extra_fluid_ml=_ALTITUDE_FLUID_BUMP_ML,
            extra_carb_g=int(round(_ALTITUDE_CARB_G_PER_KG * weight_kg)),
            iron_target_mg=iron,
            notes="Hypoxia blunts appetite and raises iron demand; keep glycogen topped up.",
        )

    if env is Environment.HEAT:
        total_sweat_l = sweat_l_per_hour * hours
        fluid_ml = int(round(total_sweat_l * 1000))
        sodium_mg = int(round(total_sweat_l * _HEAT_SODIUM_MG_PER_L_SWEAT))
        return ClimateAdjustment(
            extra_fluid_ml=fluid_ml,
            extra_sodium_mg=sodium_mg,
            notes="Replace 100% of sweat volume; 500-1000 mg Na per L sweat lost.",
        )

    if env is Environment.COLD:
        # Use Cunningham on weight as a fallback for BMR when not provided.
        # Treat weight as FFM estimate (close enough for signal-level bump).
        base_bmr = bmr_kcal if bmr_kcal is not None else cunningham(weight_kg)
        return ClimateAdjustment(
            extra_kcal=int(round(base_bmr * _COLD_KCAL_BUMP_PCT)),
            notes="Thermogenic demand ~10% BMR for sustained sub-freezing exposure.",
        )

    raise ValueError(f"Unknown environment: {env}")
