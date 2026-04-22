"""M9 Phase D — Race taper core (V2 §4.5 race prep).

Three pure-logic pieces:
- Taper phase classifier from race_date
- Carb g/kg by phase (glycogen loading curve)
- Protein maintenance g/kg (floored at 1.8 so taper never weakens tissue)
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# M9D.1 Taper phase
# ---------------------------------------------------------------------------


class TaperPhase(str, Enum):
    NORMAL = "normal"                   # >14d out or race too far away
    VOLUME_TAPER = "volume_taper"       # 14–8d — reduce volume, maintain intensity
    INTENSITY_TAPER = "intensity_taper"  # 7–4d — reduce frequency, last hard day
    GLYCOGEN_LOADING = "glycogen_loading"  # 3–1d — 3-day carb load
    RACE_DAY = "race_day"               # day 0
    RECOVERY = "recovery"               # +1 to +7d post-race


_VOLUME_TAPER_MAX_DAYS: int = 14
_VOLUME_TAPER_MIN_DAYS: int = 8
_INTENSITY_TAPER_MAX_DAYS: int = 7
_INTENSITY_TAPER_MIN_DAYS: int = 4
_GLYCOGEN_LOADING_MAX_DAYS: int = 3
_GLYCOGEN_LOADING_MIN_DAYS: int = 1
_RECOVERY_MAX_DAYS_POST: int = 7


def classify_taper_phase(race_date: Optional[date], today: date) -> TaperPhase:
    """Map days-until-race (or days-since-race) to the taper phase."""
    if race_date is None:
        return TaperPhase.NORMAL
    days_until = (race_date - today).days
    if days_until == 0:
        return TaperPhase.RACE_DAY
    if days_until < 0:
        days_since = -days_until
        if days_since <= _RECOVERY_MAX_DAYS_POST:
            return TaperPhase.RECOVERY
        return TaperPhase.NORMAL
    if days_until <= _GLYCOGEN_LOADING_MAX_DAYS:
        return TaperPhase.GLYCOGEN_LOADING
    if days_until <= _INTENSITY_TAPER_MAX_DAYS:
        return TaperPhase.INTENSITY_TAPER
    if days_until <= _VOLUME_TAPER_MAX_DAYS:
        return TaperPhase.VOLUME_TAPER
    return TaperPhase.NORMAL


# ---------------------------------------------------------------------------
# M9D.2 Carb + protein targets
# ---------------------------------------------------------------------------


_CARB_G_PER_KG_BY_PHASE: dict[TaperPhase, float] = {
    TaperPhase.NORMAL: 0.0,  # defer to baseline
    TaperPhase.VOLUME_TAPER: 6.0,
    TaperPhase.INTENSITY_TAPER: 7.0,
    TaperPhase.GLYCOGEN_LOADING: 10.0,
    TaperPhase.RACE_DAY: 9.0,
    TaperPhase.RECOVERY: 7.0,
}

_PROTEIN_FLOOR_G_PER_KG: float = 1.8


def taper_carb_g_per_kg(phase: TaperPhase, *, baseline_g_per_kg: float) -> float:
    """Carb g/kg target for this phase, never below the athlete's baseline."""
    if baseline_g_per_kg < 0:
        raise ValueError(f"baseline_g_per_kg must be non-negative, got {baseline_g_per_kg}")
    phase_target = _CARB_G_PER_KG_BY_PHASE[phase]
    return max(phase_target, baseline_g_per_kg)


def taper_protein_g_per_kg(phase: TaperPhase, *, baseline_g_per_kg: float) -> float:
    """Protein g/kg target during taper. Floored at 1.8 to preserve lean mass
    when training volume drops (V2 §4.5). Never below user baseline."""
    del phase  # placeholder — all phases share the same floor model
    if baseline_g_per_kg < 0:
        raise ValueError(f"baseline_g_per_kg must be non-negative, got {baseline_g_per_kg}")
    return max(_PROTEIN_FLOOR_G_PER_KG, baseline_g_per_kg)
