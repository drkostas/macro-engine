"""M9 Phase A — Injured mode core (V2 §4.5).

Four pure-logic pieces:
- Injury phase classifier (acute/subacute/chronic) from injury_date
- Protein g/kg by injury type, floored at pre-injury
- Injured EA hard floor: max(Cunningham, 30×FFM + rehab_kcal)
- Injury-type nutrition module lookup (supplement set + rationale)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum

from macro_engine.bmr import cunningham


# ---------------------------------------------------------------------------
# M9.1 Injury phase
# ---------------------------------------------------------------------------


class InjuryPhase(str, Enum):
    ACUTE = "acute"        # 0-10 days post-injury
    SUBACUTE = "subacute"  # 11-42 days
    CHRONIC = "chronic"    # >42 days (6+ weeks)


_ACUTE_MAX_DAYS: int = 10
_SUBACUTE_MAX_DAYS: int = 42


def classify_injury_phase(injury_date: date, today: date) -> InjuryPhase:
    """Map days-since-injury to the 3-phase state."""
    if today < injury_date:
        raise ValueError(f"today ({today}) must be >= injury_date ({injury_date})")
    days = (today - injury_date).days
    if days <= _ACUTE_MAX_DAYS:
        return InjuryPhase.ACUTE
    if days <= _SUBACUTE_MAX_DAYS:
        return InjuryPhase.SUBACUTE
    return InjuryPhase.CHRONIC


# ---------------------------------------------------------------------------
# M9.2 / M9.4 Injury type + protein + nutrition module
# ---------------------------------------------------------------------------


class InjuryType(str, Enum):
    DEFAULT = "default"
    IMMOBILIZATION = "immobilization"
    ACL = "acl"
    SEVERE = "severe"
    TENDON = "tendon"
    CONCUSSION = "concussion"
    BONE = "bone"
    STRAIN = "strain"


# Per V2 §4.5: protein tiers by injury severity.
_INJURY_PROTEIN_BASE_G_PER_KG: dict[InjuryType, float] = {
    InjuryType.DEFAULT: 2.2,
    InjuryType.STRAIN: 2.2,
    InjuryType.TENDON: 2.2,
    InjuryType.CONCUSSION: 2.2,
    InjuryType.BONE: 2.2,
    InjuryType.IMMOBILIZATION: 2.4,
    InjuryType.ACL: 2.4,
    InjuryType.SEVERE: 2.5,
}


def injury_protein_g_per_kg(
    injury_type: InjuryType,
    *,
    pre_injury_g_per_kg: float,
) -> float:
    """Return the protein target for this injury type.

    Never drops below the user's pre-injury g/kg (V2 §4.5) so athletes
    already on higher protein don't regress.
    """
    base = _INJURY_PROTEIN_BASE_G_PER_KG[injury_type]
    return max(base, pre_injury_g_per_kg)


# ---------------------------------------------------------------------------
# M9.3 Injured EA hard floor
# ---------------------------------------------------------------------------

_INJURED_EA_PER_KG_FFM: int = 30  # +5 kcal/kg above the M1.3 standard floor


def injured_ea_hard_floor(*, ffm_kg: float, rehab_kcal: float) -> int:
    """Elevated RED-S hard floor for injured athletes (V2 §4.5).

    Returns max(Cunningham(FFM), 30 × FFM + rehab_kcal). The 30 kcal/kg
    FFM constant is 5 kcal higher than the M1.3 standard 25 kcal/kg to
    fund rehab's metabolic cost.
    """
    if ffm_kg < 0:
        raise ValueError(f"ffm_kg must be non-negative, got {ffm_kg}")
    if rehab_kcal < 0:
        raise ValueError(f"rehab_kcal must be non-negative, got {rehab_kcal}")
    ea_floor = _INJURED_EA_PER_KG_FFM * ffm_kg + rehab_kcal
    return max(round(cunningham(ffm_kg)), round(ea_floor))


# ---------------------------------------------------------------------------
# M9.4 Injury nutrition module lookup
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class InjuryNutritionModule:
    label: str
    supplements: list[str] = field(default_factory=list)
    rationale: str = ""


# V2 §4.5: 5 injury-type nutrition modules.
_INJURY_MODULES: dict[InjuryType, InjuryNutritionModule] = {
    InjuryType.TENDON: InjuryNutritionModule(
        label="Tendon/ligament recovery",
        supplements=["gelatin", "vitamin C"],
        rationale="Gelatin + vit C 30-60 min pre-rehab boosts collagen synthesis (Shaw 2017).",
    ),
    InjuryType.CONCUSSION: InjuryNutritionModule(
        label="Concussion recovery",
        supplements=["creatine"],
        rationale="Creatine monohydrate 5-20 g/day improves cognitive and functional outcomes post-TBI.",
    ),
    InjuryType.ACL: InjuryNutritionModule(
        label="ACL / muscle recovery",
        supplements=["omega-3"],
        rationale="EPA + DHA 3 g/day offsets disuse-driven muscle protein breakdown.",
    ),
    InjuryType.BONE: InjuryNutritionModule(
        label="Bone recovery",
        supplements=["calcium", "vitamin D"],
        rationale="Ca 1000-1500 mg + vit D 1000-2000 IU/day supports callus formation.",
    ),
    InjuryType.STRAIN: InjuryNutritionModule(
        label="Standard recovery",
        supplements=[],
        rationale="No specific supplement stack — prioritize protein tier + sleep + whole-food quality.",
    ),
}


def get_injury_module(injury_type: InjuryType) -> InjuryNutritionModule:
    """Return the nutrition module associated with this injury type."""
    if injury_type in _INJURY_MODULES:
        return _INJURY_MODULES[injury_type]
    # DEFAULT / IMMOBILIZATION / ACL / SEVERE map to the closest module
    # (acl → ACL's omega-3 module; others fall back to standard).
    if injury_type == InjuryType.ACL:
        return _INJURY_MODULES[InjuryType.ACL]
    return _INJURY_MODULES[InjuryType.STRAIN]
