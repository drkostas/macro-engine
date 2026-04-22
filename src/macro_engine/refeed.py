"""M6 Phase A — Refeed macros system (V2 §4.2).

Three pure functions:
- is_refeed_day: detect whether a logged day matches the implicit refeed rule
- compute_refeed_targets: generate carb-heavy target macros for a planned refeed
- apply_refeed_to_counter: reduce the deficit duration counter after a refeed
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


# ---------------------------------------------------------------------------
# M6.1 Implicit refeed detection (V2 §4.2)
# ---------------------------------------------------------------------------

_REFEED_KCAL_FRACTION: float = 0.95
_REFEED_CARB_G_PER_KG: float = 5.0
_REFEED_FAT_CEILING_G_PER_KG: float = 1.0


def is_refeed_day(
    *,
    kcal: float,
    tdee: float,
    carbs_g: float,
    fat_g: float,
    weight_kg: float,
) -> bool:
    """Apply V2 §4.2 implicit refeed detection rule.

    Returns True when ALL three conditions hold:
      - kcal ≥ 95% TDEE
      - carbs ≥ 5 g/kg body weight
      - fat ≤ 1.0 g/kg body weight
    """
    if tdee <= 0 or weight_kg <= 0:
        raise ValueError(f"tdee and weight_kg must be positive (tdee={tdee}, weight_kg={weight_kg})")

    return (
        kcal >= _REFEED_KCAL_FRACTION * tdee
        and carbs_g >= _REFEED_CARB_G_PER_KG * weight_kg
        and fat_g <= _REFEED_FAT_CEILING_G_PER_KG * weight_kg
    )


# ---------------------------------------------------------------------------
# M6.2 Refeed target generator
# ---------------------------------------------------------------------------

_REFEED_PROTEIN_G_PER_KG: float = 2.0
_REFEED_CARB_TARGET_G_PER_KG: float = 7.0  # V2 §4.2 midpoint of 6-8
_REFEED_FAT_TARGET_G_PER_KG: float = 0.7   # below 1.0 ceiling, carb room


class RefeedIntensity(str, Enum):
    MAINTENANCE = "maintenance"
    PLUS_5 = "plus_5"
    PLUS_10 = "plus_10"


_INTENSITY_FACTOR: dict[RefeedIntensity, float] = {
    RefeedIntensity.MAINTENANCE: 1.00,
    RefeedIntensity.PLUS_5: 1.05,
    RefeedIntensity.PLUS_10: 1.10,
}


@dataclass(frozen=True)
class RefeedTargets:
    kcal: int
    protein_g: int
    carbs_g: int
    fat_g: int


def compute_refeed_targets(
    *,
    weight_kg: float,
    tdee: float,
    intensity: RefeedIntensity = RefeedIntensity.MAINTENANCE,
) -> RefeedTargets:
    """Generate refeed day macro targets per V2 §4.2."""
    if weight_kg <= 0:
        raise ValueError(f"weight_kg must be positive, got {weight_kg}")
    if tdee <= 0:
        raise ValueError(f"tdee must be positive, got {tdee}")

    kcal = round(tdee * _INTENSITY_FACTOR[intensity])
    return RefeedTargets(
        kcal=kcal,
        protein_g=round(_REFEED_PROTEIN_G_PER_KG * weight_kg),
        carbs_g=round(_REFEED_CARB_TARGET_G_PER_KG * weight_kg),
        fat_g=round(_REFEED_FAT_TARGET_G_PER_KG * weight_kg),
    )


# ---------------------------------------------------------------------------
# M6.3 Counter impact (V2 §3.4)
# ---------------------------------------------------------------------------

_SINGLE_REFEED_SUBTRACT: int = 3
_TWO_DAY_REFEED_SUBTRACT: int = 6


def apply_refeed_to_counter(
    current_counter: int,
    *,
    refeed_length_days: int,
) -> int:
    """Reduce the M1.7 deficit duration counter following a refeed.

    Single-day refeed → counter -3.
    Two-day refeed → counter -6.
    Counter floors at 0.
    """
    if refeed_length_days == 1:
        delta = _SINGLE_REFEED_SUBTRACT
    elif refeed_length_days == 2:
        delta = _TWO_DAY_REFEED_SUBTRACT
    else:
        raise ValueError(
            f"refeed_length_days must be 1 or 2, got {refeed_length_days}"
        )
    return max(0, current_counter - delta)
