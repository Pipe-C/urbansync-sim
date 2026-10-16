"""The adaptive controller — the policy the whole project argues for.

It differs from the fixed reference in exactly one decision (`choose`), plus the
two things that decision implies: a starvation bound so the greedy choice cannot
capture the junction, and preemption so an emergency vehicle is not made to wait
for a cycle that has nothing else to do.

`choose` is a straight port of `SignalController.choose` from the browser engine,
through-movement branch. It is kept here in the same shape, comments and all,
because the measurement that produced it — the starvation fix that closed a
junction which had `served` frozen at 54 for five minutes — is the reason the
bound exists, and a port that dropped the reasoning would invite its removal.
"""

from __future__ import annotations

from app.services.algorithm.controller import (
    MAX_CONSECUTIVE_SKIPS,
    SignalController,
    arm_name,
)
from app.services.simulation.state import ARMS, Arm, SimulationState


class AdaptiveController(SignalController):
    """Serves the approach with the most pressure, bounded against starvation."""

    def __init__(self) -> None:
        super().__init__()
        self._reason = ""

    def choose(self, state: SimulationState) -> Arm:
        best_arm = ARMS[0]
        best_pressure = -1.0
        best_age = -1

        for arm in ARMS:
            pressure = state.pressure(arm)
            # `self.served_count - last_served` is the arm's age: how many greens
            # have been handed out since this one. Ties fall to the older arm.
            age = self.served_count - self._last_served[arm]
            if pressure > best_pressure or (pressure == best_pressure and age > best_age):
                best_arm, best_pressure, best_age = arm, pressure, age

        # Fairness is a bound, not a preference.
        #
        # On a saturated junction an arm that keeps the most pressure keeps winning
        # the next green, and its neighbours — which are not being served — cannot
        # catch up: the thing doing the reinforcing is the comparison itself, so
        # nothing downstream of it can break the loop. An arm passed over more
        # times than there are other approaches is therefore served whatever its
        # pressure says. An approach's age runs 0..3 round-robin, so three skips
        # means it has been missed a full lap and is next in line regardless.
        overdue_arm: Arm | None = None
        overdue_age = -1
        for arm in ARMS:
            age = self.served_count - self._last_served[arm]
            if age > MAX_CONSECUTIVE_SKIPS and age > overdue_age:
                overdue_arm, overdue_age = arm, age

        if overdue_arm is not None:
            self._reason = f"Turno pendiente en {arm_name(overdue_arm)}"
            return overdue_arm

        self._reason = f"Mayor presión en {arm_name(best_arm)}"
        return best_arm

    def switch_reason(self, arm: Arm) -> str:
        return self._reason

    def preemption_request(self, state: SimulationState) -> Arm | None:
        """An emergency vehicle holds its approach until it has been cleared.

        The state answers with the approach a still-queued emergency vehicle is on,
        and clears the answer the moment the vehicle is discharged — so preemption
        ends when the vehicle is through, not when it arrived.
        """
        return state.preemption_arm()
