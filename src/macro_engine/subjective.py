"""M7 Phase A — Subjective signal scoring (V2 §9 / V3).

Four pure-logic score functions:
- Hooper 4-item wellness score
- 28-day Z-score alert from Hooper history
- Foster session-RPE strain + weekly monotony
- PHQ-2 + SCOFF screener thresholds
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass
from typing import Literal


# ---------------------------------------------------------------------------
# M7.1 Hooper
# ---------------------------------------------------------------------------


HooperQuality = Literal["good", "moderate", "poor"]


@dataclass(frozen=True)
class HooperScore:
    total: int
    fatigue: int
    sleep: int
    stress: int
    soreness: int
    quality: HooperQuality


def _validate_hooper_item(name: str, value: int) -> None:
    if not (1 <= value <= 7):
        raise ValueError(f"{name} must be 1-7, got {value}")


def compute_hooper_score(
    *,
    fatigue: int,
    sleep: int,
    stress: int,
    soreness: int,
) -> HooperScore:
    """Return the 4-item Hooper wellness composite."""
    for name, v in [("fatigue", fatigue), ("sleep", sleep),
                    ("stress", stress), ("soreness", soreness)]:
        _validate_hooper_item(name, v)
    total = fatigue + sleep + stress + soreness
    if total <= 10:
        quality: HooperQuality = "good"
    elif total <= 17:
        quality = "moderate"
    else:
        quality = "poor"
    return HooperScore(
        total=total, fatigue=fatigue, sleep=sleep,
        stress=stress, soreness=soreness, quality=quality,
    )


# ---------------------------------------------------------------------------
# M7.2 Hooper Z-score alert
# ---------------------------------------------------------------------------


AlertLevel = Literal["normal", "elevated", "high"]

_HOOPER_ALERT_MIN_HISTORY: int = 14
_HOOPER_ALERT_WINDOW: int = 28


@dataclass(frozen=True)
class HooperAlert:
    z_score: float
    alert_level: AlertLevel
    baseline_mean: float
    baseline_std: float


def compute_hooper_alert(today_total: int, history: list[int]) -> HooperAlert:
    """Compare today's Hooper total against a 28-day trailing baseline."""
    if len(history) < _HOOPER_ALERT_MIN_HISTORY:
        return HooperAlert(
            z_score=0.0, alert_level="normal",
            baseline_mean=0.0, baseline_std=0.0,
        )
    window = history[-_HOOPER_ALERT_WINDOW:]
    mean = statistics.fmean(window)
    std = statistics.pstdev(window) if len(window) > 1 else 0.0
    if std == 0:
        return HooperAlert(
            z_score=0.0, alert_level="normal",
            baseline_mean=mean, baseline_std=0.0,
        )
    z = (today_total - mean) / std
    if abs(z) <= 1:
        level: AlertLevel = "normal"
    elif abs(z) <= 2:
        level = "elevated"
    else:
        level = "high"
    return HooperAlert(
        z_score=z, alert_level=level,
        baseline_mean=mean, baseline_std=std,
    )


# ---------------------------------------------------------------------------
# M7.3 Foster session-RPE strain + monotony
# ---------------------------------------------------------------------------


_MONOTONY_CAP: float = 100.0


def session_strain(rpe_0_10: float, duration_min: float) -> float:
    """Foster 2001 session-RPE: strain = RPE × duration_minutes."""
    if rpe_0_10 < 0 or rpe_0_10 > 10:
        raise ValueError(f"rpe_0_10 must be 0-10, got {rpe_0_10}")
    if duration_min < 0:
        raise ValueError(f"duration_min must be >= 0, got {duration_min}")
    return rpe_0_10 * duration_min


@dataclass(frozen=True)
class WeeklyStrain:
    total: float
    monotony: float
    strain: float


def compute_weekly_strain(daily_strains_7d: list[float]) -> WeeklyStrain:
    """Foster weekly strain: total × monotony where monotony = mean/std.

    When std=0 (flat week), monotony is clamped to _MONOTONY_CAP rather than
    returning inf — a flat week IS overtraining-prone, but inf breaks UIs.
    """
    if not daily_strains_7d:
        return WeeklyStrain(total=0, monotony=0, strain=0)
    total = sum(daily_strains_7d)
    mean = statistics.fmean(daily_strains_7d)
    std = statistics.pstdev(daily_strains_7d) if len(daily_strains_7d) > 1 else 0.0
    if std == 0 or math.isclose(std, 0, abs_tol=1e-9):
        monotony = _MONOTONY_CAP if mean > 0 else 0
    else:
        monotony = mean / std
    strain = total * monotony
    return WeeklyStrain(total=total, monotony=monotony, strain=strain)


# ---------------------------------------------------------------------------
# M7.4 PHQ-2 + SCOFF
# ---------------------------------------------------------------------------


_PHQ2_TRIGGER_THRESHOLD: int = 3
_SCOFF_FLAG_THRESHOLD: int = 2


def phq2_score(little_interest: int, feeling_down: int) -> tuple[int, bool]:
    """PHQ-2 screener. Returns (score, triggers_phq9)."""
    for name, v in [("little_interest", little_interest), ("feeling_down", feeling_down)]:
        if not (0 <= v <= 3):
            raise ValueError(f"{name} must be 0-3, got {v}")
    score = little_interest + feeling_down
    return score, score >= _PHQ2_TRIGGER_THRESHOLD


def scoff_score(
    *,
    sick_after_full: bool,
    worry_control: bool,
    one_stone_3mo: bool,
    fat_when_thin: bool,
    food_dominates: bool,
) -> tuple[int, bool]:
    """SCOFF 5-item eating disorder screener. Returns (score, flagged)."""
    score = sum([
        1 if sick_after_full else 0,
        1 if worry_control else 0,
        1 if one_stone_3mo else 0,
        1 if fat_when_thin else 0,
        1 if food_dominates else 0,
    ])
    return score, score >= _SCOFF_FLAG_THRESHOLD
