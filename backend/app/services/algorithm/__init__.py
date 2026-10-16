"""Traffic control: the adaptive policy and the fixed reference it beats.

Both share one state machine, so they differ only in their `choose` — same
interlocks, same amber and all-red, one different decision. That is what lets the
benchmark call them comparable.
"""

from app.services.algorithm.adaptive_controller import AdaptiveController
from app.services.algorithm.controller import (
    ALL_RED,
    AMBER,
    MAX_CONSECUTIVE_SKIPS,
    MAX_GREEN,
    MIN_GREEN,
    Phase,
    PhaseKind,
    SignalController,
    arm_name,
    same_axis,
)
from app.services.algorithm.fixed_controller import AXES, FIXED_GREEN, FixedController

__all__ = [
    "ALL_RED",
    "AMBER",
    "AXES",
    "AdaptiveController",
    "FIXED_GREEN",
    "FixedController",
    "MAX_CONSECUTIVE_SKIPS",
    "MAX_GREEN",
    "MIN_GREEN",
    "Phase",
    "PhaseKind",
    "SignalController",
    "arm_name",
    "same_axis",
]
