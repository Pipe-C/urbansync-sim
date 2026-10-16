"""The signal state machine, shared by both controllers.

This is the product's core, and it is written as a named state machine with a
`reason` on every transition rather than as a scatter of booleans — because
`PRODUCT.md` makes explainability a feature and `DESIGN.md` says the control room
is not decoration. When a phase changes, the string says which rule fired, and an
evaluator can read the transition back without stepping through the code.

The law is three rules and a tie-break, all of them lifted from
`frontend/src/simulation/core/controller.ts` so the two engines obey one policy:

1. **Pressure** decides which approach is served. The quantity itself lives in
   the model (`SimulationState.pressure`); `choose` is the only thing a subclass
   replaces, which is what makes adaptive and fixed comparable — same interlocks,
   same amber, same all-red, one different decision.
2. **Interlocks** bound it. A green is never shorter than its floor and never
   longer than its ceiling, so the cycle cannot collapse to a flicker and no
   approach can hold the junction indefinitely.
3. **Preemption** overrides both, once, for an emergency vehicle — and only in the
   subclass that offers it. A fixed cycle *cannot* preempt, and that asymmetry is
   the demonstration, not a missing feature.

Through moves only, for now. The browser's protected left phase needs lane
geometry this model does not carry; when lefts arrive they slot in here as a
second `GreenKind`, and the timing rules above already bound them.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from app.services.simulation.state import ARMS, OPPOSITE, Aspect, Arm, SimulationState

#: A green shorter than this reads to a driver as a flicker, not a signal.
MIN_GREEN = 11.0

#: After this long the served approach yields even if nothing else is waiting.
MAX_GREEN = 21.0

#: Clearance between a green and the next: enough for a car at approach speed to
#: stop in the distance it has.
AMBER = 3.2

#: The interval the cross traffic gets to clear the box before anyone else moves.
ALL_RED = 2.2

#: How many greens in a row an approach may be passed over before it is served
#: regardless of pressure. Served round-robin an approach's age runs 0..3, so
#: three skips means it has been missed a full lap. See `AdaptiveController.choose`
#: for why this is a bound and not a preference.
MAX_CONSECUTIVE_SKIPS = 3

ARM_LABEL: dict[Arm, str] = {
    Arm.NORTH: "Av. Norte",
    Arm.EAST: "Calle Este",
    Arm.SOUTH: "Av. Sur",
    Arm.WEST: "Calle Oeste",
}


def arm_name(arm: Arm) -> str:
    return ARM_LABEL[arm]


def same_axis(a: Arm, b: Arm) -> bool:
    """True when two arms are the two directions of one road.

    The controller serves an axis — an approach and its opposite — on one green, so
    a fresh choice that lands on the opposite arm is the *same* decision, not a
    reason to end the green and burn an all-red. The browser compares arms here;
    comparing axes is the correction, and it is the one place this file knowingly
    improves on the law it mirrors.
    """
    return a is b or OPPOSITE[a] is b


class PhaseKind(StrEnum):
    GREEN = "green"
    AMBER = "amber"
    ALL_RED = "allRed"


@dataclass
class Phase:
    kind: PhaseKind
    #: The approach (and, through `same_axis`, its opposite) being served. Kept
    #: through amber and the following all-red as the *clearing* arm, so a reason
    #: string can name what is being cleared.
    arm: Arm | None
    elapsed: float
    reason: str


class SignalController:
    """The interlocks, the clearance intervals and the preemption latch.

    Subclasses implement `choose`; everything else is the same machine. `step` is
    handed the model every tick and decides only the phase — it never touches the
    queues, which the state discharges from the aspects this controller publishes.
    """

    def __init__(self) -> None:
        self._phase = Phase(PhaseKind.ALL_RED, None, 0.0, "Arranque del sistema")
        self._served_count = 0
        self._last_served: dict[Arm, int] = dict.fromkeys(ARMS, 0)
        self._preemption_arm: Arm | None = None

    @property
    def phase(self) -> Phase:
        return self._phase

    @property
    def served_count(self) -> int:
        return self._served_count

    def aspects(self) -> dict[Arm, Aspect]:
        """What each approach is shown. A green serves an axis, so the served arm
        and its opposite light together and the perpendicular pair stays red."""
        result: dict[Arm, Aspect] = dict.fromkeys(ARMS, Aspect.RED)
        phase = self._phase
        if phase.arm is None or phase.kind is PhaseKind.ALL_RED:
            return result

        aspect = Aspect.GREEN if phase.kind is PhaseKind.GREEN else Aspect.AMBER
        result[phase.arm] = aspect
        result[OPPOSITE[phase.arm]] = aspect
        return result

    def step(self, dt: float, state: SimulationState) -> None:
        # The latch. An emergency approach is remembered for as long as it is
        # asking, so the controller cannot forget it half way through switching
        # away — the flicker that produces is a signal fault, and a signal fault
        # during an emergency is the one thing preemption exists to prevent.
        self._preemption_arm = self.preemption_request(state)
        self._phase.elapsed += dt

        if self._phase.kind is PhaseKind.GREEN:
            self._step_green(state)
        elif self._phase.kind is PhaseKind.AMBER:
            self._step_amber()
        else:
            self._step_all_red(state)

    # --- the three states -----------------------------------------------------

    def _step_green(self, state: SimulationState) -> None:
        arm = self._phase.arm
        assert arm is not None  # a green always has a served arm

        # Preemption outranks the minimum green: an ambulance on another approach
        # cannot wait for the current one's floor to elapse.
        if self._preemption_arm is not None and not same_axis(self._preemption_arm, arm):
            self._to_amber(f"Preemptión: emergencia en {arm_name(self._preemption_arm)}")
            return

        if self._phase.elapsed < self.min_green():
            return

        if self._phase.elapsed >= self.green_seconds():
            self._to_amber("Green máximo alcanzado")
            return

        choice = self.choose(state)
        if not same_axis(choice, arm):
            self._to_amber(self.switch_reason(choice))

    def _step_amber(self) -> None:
        if self._phase.elapsed < AMBER:
            return
        arm = self._phase.arm
        self._phase = Phase(
            PhaseKind.ALL_RED,
            arm,
            0.0,
            f"Fin de ámbar en {arm_name(arm)}" if arm is not None else "Fin de ámbar",
        )

    def _step_all_red(self, state: SimulationState) -> None:
        if self._phase.elapsed < ALL_RED:
            return

        if self._preemption_arm is not None:
            arm = self._preemption_arm
            self._to_green(arm, f"Preemptión: emergencia en {arm_name(arm)}")
            return

        choice = self.choose(state)
        self._to_green(choice, self.switch_reason(choice))

    # --- transitions ----------------------------------------------------------

    def _to_green(self, arm: Arm, reason: str) -> None:
        self._served_count += 1
        # Both arms of the axis are served by one green, so both have their age
        # reset. Recording only the chosen arm would let its opposite — served the
        # whole time, but never *named* — accumulate phantom age until the
        # starvation bound re-served the axis it had just served.
        self._last_served[arm] = self._served_count
        self._last_served[OPPOSITE[arm]] = self._served_count
        self._phase = Phase(PhaseKind.GREEN, arm, 0.0, reason)

    def _to_amber(self, reason: str) -> None:
        self._phase = Phase(PhaseKind.AMBER, self._phase.arm, 0.0, reason)

    # --- subclass hooks -------------------------------------------------------

    def choose(self, state: SimulationState) -> Arm:
        """Which approach to serve next. The one thing that differs by policy."""
        raise NotImplementedError

    def preemption_request(self, state: SimulationState) -> Arm | None:
        """The approach an emergency vehicle is on, if this controller preempts.

        The default is to ignore it, which is how the fixed reference stays fixed.
        """
        return None

    def min_green(self) -> float:
        return MIN_GREEN

    def green_seconds(self) -> float:
        return MAX_GREEN

    def switch_reason(self, arm: Arm) -> str:
        return f"Mayor presión en {arm_name(arm)}"
