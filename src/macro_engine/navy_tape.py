"""Navy tape circumference-based BF% + FFM (M3.6).

Research basis: Hodgdon & Beckett 1984, adopted by US Navy for body-fat
estimation from neck/waist (and hip, for females) measurements. Paired with
the M3.2 sigma lookup: Navy tape gets sigma = 2.2 kg (see method_sigma.py).
"""

from __future__ import annotations

import math
from typing import Literal

Sex = Literal["male", "female"]

_BF_MIN = 3.0
_BF_MAX = 60.0

# Hodgdon & Beckett's constants were fit on inch measurements. We accept cm
# for API ergonomics and convert before applying the formula.
_CM_PER_INCH: float = 2.54


def _log10(x: float) -> float:
    return math.log10(x)


def _to_inches(cm: float) -> float:
    return cm / _CM_PER_INCH


def _validate_positive(**values: float) -> None:
    for name, v in values.items():
        if not (v > 0):
            raise ValueError(f"{name} must be positive, got {v}")


def navy_tape_bf_pct(
    *,
    neck_cm: float,
    waist_cm: float,
    height_cm: float,
    sex: Sex,
    hip_cm: float | None = None,
) -> float:
    """Body-fat percentage from Navy tape circumferences.

    Male formula uses waist - neck; female uses waist + hip - neck.
    """
    _validate_positive(neck_cm=neck_cm, waist_cm=waist_cm, height_cm=height_cm)

    neck_in = _to_inches(neck_cm)
    waist_in = _to_inches(waist_cm)
    height_in = _to_inches(height_cm)

    if sex == "male":
        diff_in = waist_in - neck_in
        if diff_in <= 0:
            raise ValueError(
                f"waist ({waist_cm}) must exceed neck ({neck_cm}) for the male formula",
            )
        bf = 86.010 * _log10(diff_in) - 70.041 * _log10(height_in) + 36.76
    elif sex == "female":
        if hip_cm is None:
            raise ValueError("hip_cm is required for female Navy tape calculation")
        _validate_positive(hip_cm=hip_cm)
        hip_in = _to_inches(hip_cm)
        diff_in = waist_in + hip_in - neck_in
        if diff_in <= 0:
            raise ValueError(
                "waist + hip must exceed neck for the female formula",
            )
        bf = 163.205 * _log10(diff_in) - 97.684 * _log10(height_in) - 78.387
    else:
        raise ValueError(f"sex must be 'male' or 'female', got {sex!r}")

    return max(_BF_MIN, min(_BF_MAX, bf))


def navy_tape_ffm_kg(
    *,
    weight_kg: float,
    neck_cm: float,
    waist_cm: float,
    height_cm: float,
    sex: Sex,
    hip_cm: float | None = None,
) -> float:
    """Fat-free mass (kg) from Navy tape BF% and body weight."""
    _validate_positive(weight_kg=weight_kg)
    bf = navy_tape_bf_pct(
        neck_cm=neck_cm,
        waist_cm=waist_cm,
        height_cm=height_cm,
        sex=sex,
        hip_cm=hip_cm,
    )
    return weight_kg * (1.0 - bf / 100.0)
