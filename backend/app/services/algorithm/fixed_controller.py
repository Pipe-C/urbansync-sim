"""The fixed-cycle reference the adaptive controller is measured against.

A fixed-time signal runs a rhythm and keeps it: each axis is green for the same
long interval whatever the traffic is doing, and the cycle length is constant.
That is not a straw man — real junctions ran this way for decades, and it is
genuinely adequate when demand is steady and balanced. Its failure is precisely
the case the product demonstrates: it cannot react, and an empty road holds a
green while an ambulance waits at a red that will not change early.

Two consequences of being fixed are expressed here rather than in the state
machine:

- Its green floor and ceiling are the same number, so the shared machinery can
  never end a green early on pressure — it always runs the full fixed interval.
- It does not preempt. It inherits the base `preemption_request`, which returns
  `None`, so an emergency vehicle is served in its turn like any other. That is
  the asymmetry, and it is deliberate.
"""

from __future__ import annotations

from app.services.algorithm.controller import SignalController
from app.services.simulation.state import Arm, SimulationState

#: Seconds of green per axis. With amber and all-red the full two-phase cycle is
#: `2 * (FIXED_GREEN + AMBER + ALL_RED)` — just over a minute, which is a
#: plausible fixed-time plan and leaves the cycle's rhythm visible on the chart.
FIXED_GREEN = 25.0

#: The two axes, each named by one of its arms. The junction is two-phase, so
#: there are exactly two, and they are served in strict rotation.
AXES: tuple[Arm, Arm] = (Arm.NORTH, Arm.EAST)


class FixedController(SignalController):
    """Alternates the two axes on a constant green. No pressure, no preemption."""

    def __init__(self) -> None:
        super().__init__()
        self._cursor = -1

    def choose(self, state: SimulationState) -> Arm:
        # Called once per cycle, when the all-red expires. Advancing a cursor here
        # rather than comparing against the current arm keeps the rotation honest:
        # a fixed signal does not look at what it is serving, it just goes to the
        # next axis in the plan.
        self._cursor = (self._cursor + 1) % len(AXES)
        return AXES[self._cursor]

    def switch_reason(self, arm: Arm) -> str:
        return "Ciclo fijo"

    def min_green(self) -> float:
        return FIXED_GREEN

    def green_seconds(self) -> float:
        return FIXED_GREEN
