"""The intersection model: its state, and the quantities a controller reads.

This is the backend's `core/`. It knows nothing about HTTP, sockets or the
database, so a control law can be run and checked here — with the same arrivals,
across many seeds — in a few milliseconds and with no server in the loop. That is
the whole reason it is a separate package.

### What is modelled, and what is deliberately not

The browser engine (`frontend/src/simulation/core/`) simulates the geometry: a
vehicle's position is an arc length advanced by physics, and whether two bodies
share a square metre is a question about space. None of that is here. This is a
*queueing* model of the same junction, because the backend's job is the control
decision and the numbers a controller is judged on — how long vehicles waited,
how many cleared, how fast an ambulance got through — and none of those needs a
vehicle's position to be right, only the order and the clock.

So a vehicle is admitted to a lane's queue when it arrives, leaves that queue when
the signal discharges it, and records exactly two facts: when it arrived and
whether it is an emergency. Everything downstream — pressure, wait, throughput —
is derived from those. Four approaches of two lanes each, which is the junction
`PRODUCT.md` commits to, and through movements only for now: the protected left
phase the browser earned depends on lane geometry (which left-turner can reach the
line, which movements cross) that an abstract queue simply does not have. Lefts
are a later slice, not a simplification to be quietly forgotten.

### Pressure is the same formula as the browser's

`pressure(arm) = Σ (1 + waited/12)`, with `waited` capped at `PRESSURE_HORIZON`.
This is `pressureOf` in `frontend/src/simulation/core/controller.ts` and the cap is
`PRESSURE_HORIZON` in `world.ts`, restated here rather than re-derived, because the
project's claim is that it has *one* control law. A backend that invented its own
would make the two engines disagree about the thing the product exists to show.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Protocol


class Arm(StrEnum):
    """The four approaches, named for the direction traffic travels *from*.

    Mirrors `Arm` in `frontend/src/simulation/core/layout.ts`, and the API's
    `Approach` in `frontend/src/types/metrics.ts` — the same four values under two
    names is already one too many, so this module does not add a third spelling.
    """

    NORTH = "north"
    EAST = "east"
    SOUTH = "south"
    WEST = "west"


ARMS: tuple[Arm, ...] = (Arm.NORTH, Arm.EAST, Arm.SOUTH, Arm.WEST)


class Aspect(StrEnum):
    """What one approach is being shown. Mirrors `Aspect` in `controller.ts`.

    Defined here, in the model, rather than in the algorithm package, so the
    dependency between the two stays one-way: a controller publishes aspects, the
    state consumes them to discharge, and the state never imports a controller.
    """

    GREEN = "green"
    AMBER = "amber"
    RED = "red"

OPPOSITE: dict[Arm, Arm] = {
    Arm.NORTH: Arm.SOUTH,
    Arm.SOUTH: Arm.NORTH,
    Arm.EAST: Arm.WEST,
    Arm.WEST: Arm.EAST,
}

#: Two lanes per approach, as `layout.ts` lays them out. The controller greets
#: both together — an approach's lanes share one signal head — so this matters to
#: capacity and to the queue metric, not to the phase decision.
LANES_PER_ARM = 2

#: A vehicle still waiting after this long is no more informative than one that
#: arrived at the horizon: past it, every vehicle in a saturated queue is in the
#: same state and the differences are only arrival order. Uncapped, waiting is
#: self-reinforcing — the longest-waiting vehicle exerts the most pressure, is
#: served first, and the queue behind it never accumulates enough of its own.
PRESSURE_HORIZON = 120.0

#: The constant in the pressure formula: roughly the wait a driver tolerates
#: before taking it personally. A car that has waited twelve seconds therefore
#: counts double one that has just arrived.
PRESSURE_DIVISOR = 12.0

#: Seconds between successive discharges from one lane while it is green. Two
#: seconds a vehicle is the standard saturation headway and the reason a queue of
#: ten takes twenty seconds to clear rather than clearing at once.
SATURATION_HEADWAY = 2.0

#: The tick. `PLAN.md`'s Phase 3 runs the algorithm every 100 ms, and the whole
#: simulator — the browser engine and the socket stream that will feed from here —
#: is built around that being the model's resolution.
TICK_SECONDS = 0.1


def lane_key(arm: Arm, index: int) -> str:
    """The same `arm-index` spelling `layout.ts` uses for a lane id."""
    return f"{arm.value}-{index}"


@dataclass(frozen=True)
class Arrival:
    """One vehicle entering the model, before it is given an identity.

    Frozen because the generator's output is the *sequence* the benchmark replays
    through both controllers; a run that could mutate its own input could not
    honestly claim the two runs saw the same traffic.
    """

    t: float
    arm: Arm
    lane: int
    kind: str
    emergency: bool = False


@dataclass
class Vehicle:
    """A vehicle waiting in, or being discharged from, a lane's queue."""

    id: int
    kind: str
    arm: Arm
    lane: int
    arrived_at: float
    emergency: bool


@dataclass(frozen=True)
class Metrics:
    """One strategy's reading, the four quantities of `StrategyFrame`.

    Cumulative since the run started. The per-window framing the dashboard samples
    is Phase 4; the benchmark decides between strategies on the whole run, and a
    running total is what that needs.
    """

    average_wait_seconds: float
    throughput_per_minute: float
    emergency_response_seconds: float
    longest_queue: int


@dataclass
class SimulationState:
    """Everything a controller is allowed to read, and the model it advances.

    The state owns admission and discharge — the physics, such as it is — and the
    controller owns the phase. Keeping them apart is what makes the two
    controllers comparable: they differ only in their `choose`, and run against a
    state that is otherwise identical.
    """

    clock: float = 0.0
    queues: dict[str, deque[Vehicle]] = field(default_factory=dict)
    #: Seconds of green a lane must still accrue before it may discharge again.
    #: Reset to zero the moment its approach goes red, so a green always starts
    #: by clearing the car already at the line.
    _headway: dict[str, float] = field(default_factory=dict, repr=False)
    _next_id: int = field(default=1, repr=False)

    served: int = 0
    total_wait: float = 0.0
    peak_queue: int = 0
    emergency_waits: list[float] = field(default_factory=list)

    def __post_init__(self) -> None:
        for arm in ARMS:
            for index in range(LANES_PER_ARM):
                key = lane_key(arm, index)
                self.queues.setdefault(key, deque())
                self._headway.setdefault(key, 0.0)

    # --- admission and discharge ---------------------------------------------

    def admit(self, arrival: Arrival) -> Vehicle:
        """Put an arriving vehicle at the back of its lane's queue.

        Lane-level rather than arm-level because the generator emits a stream per
        lane, exactly as the browser's `updateArrivals` does; the two lanes of an
        approach are served together but arrive independently.
        """
        vehicle = Vehicle(
            id=self._next_id,
            kind=arrival.kind,
            arm=arrival.arm,
            lane=arrival.lane,
            arrived_at=arrival.t,
            emergency=arrival.emergency,
        )
        self._next_id += 1
        self.queues[lane_key(arrival.arm, arrival.lane)].append(vehicle)
        return vehicle

    def discharge(self, dt: float, aspects: dict[Arm, str]) -> int:
        """Release queued vehicles from every green lane, at saturation headway.

        Returns the number discharged this tick. A lane discharges one vehicle
        every `SATURATION_HEADWAY` seconds of green; `dt` is charged to that
        countdown rather than vehicles being removed all at once, because the pace
        of a discharge is the difference between a signal that clears a queue and
        a signal that teleports one.
        """
        released = 0
        for arm in ARMS:
            green = aspects.get(arm) == Aspect.GREEN
            for index in range(LANES_PER_ARM):
                key = lane_key(arm, index)
                queue = self.queues[key]
                if not green:
                    # A red cancels any accrued green: the next green must be able
                    # to clear the car at the line immediately, not finish a
                    # countdown that belonged to a phase now over.
                    self._headway[key] = 0.0
                    continue

                self._headway[key] -= dt
                while self._headway[key] <= 0 and queue:
                    vehicle = queue.popleft()
                    wait = self.clock - vehicle.arrived_at
                    self.served += 1
                    self.total_wait += wait
                    if vehicle.emergency:
                        self.emergency_waits.append(wait)
                    released += 1
                    self._headway[key] += SATURATION_HEADWAY
                if not queue:
                    self._headway[key] = 0.0
        return released

    # --- what a controller reads ---------------------------------------------

    def queued(self, arm: Arm) -> int:
        """Vehicles waiting on one approach, summed across its lanes."""
        return sum(len(self.queues[lane_key(arm, index)]) for index in range(LANES_PER_ARM))

    def pressure(self, arm: Arm) -> float:
        """The browser's control quantity, restated.

        `Σ (1 + waited/12)` over the vehicles queued on the approach, with each
        vehicle's wait capped at the horizon. The `1` is the vehicle itself and the
        fraction is how long it has been standing, so a single car that has waited
        twenty seconds outweighs four that have just arrived — the property that
        stops a busy approach starving an idle one.
        """
        total = 0.0
        for index in range(LANES_PER_ARM):
            for vehicle in self.queues[lane_key(arm, index)]:
                waited = min(self.clock - vehicle.arrived_at, PRESSURE_HORIZON)
                total += 1.0 + waited / PRESSURE_DIVISOR
        return total

    def preemption_arm(self) -> Arm | None:
        """The approach an emergency vehicle is waiting on, if any.

        The longest-waiting one when a junction happens to hold two: it is the
        more urgent, and returning the first found would make the answer depend on
        lane order rather than on need.
        """
        best_arm: Arm | None = None
        best_arrival = float("inf")
        for arm in ARMS:
            for index in range(LANES_PER_ARM):
                for vehicle in self.queues[lane_key(arm, index)]:
                    if vehicle.emergency and vehicle.arrived_at < best_arrival:
                        best_arm = arm
                        best_arrival = vehicle.arrived_at
        return best_arm

    def observe_peak(self) -> None:
        """Remember the longest single-approach queue seen so far."""
        for arm in ARMS:
            self.peak_queue = max(self.peak_queue, self.queued(arm))

    def snapshot(self) -> Metrics:
        """The run's cumulative reading, in the four `StrategyFrame` quantities."""
        average_wait = self.total_wait / self.served if self.served else 0.0
        minutes = self.clock / 60.0
        throughput = self.served / minutes if minutes > 0 else 0.0
        emergency = (
            sum(self.emergency_waits) / len(self.emergency_waits)
            if self.emergency_waits
            else 0.0
        )
        return Metrics(
            average_wait_seconds=average_wait,
            throughput_per_minute=throughput,
            emergency_response_seconds=emergency,
            longest_queue=self.peak_queue,
        )


class ControllerProtocol(Protocol):
    """What `run` needs from a controller.

    Structural rather than a base class, so this module never imports the
    algorithm package: the dependency runs one way — `algorithm/` reads
    `simulation/` — exactly as the browser's `three/` reads `core/` and `core/`
    never reaches back.
    """

    def step(self, dt: float, state: SimulationState) -> None: ...

    def aspects(self) -> dict[Arm, str]: ...


def run(
    arrivals: list[Arrival],
    controller: ControllerProtocol,
    *,
    duration: float | None = None,
    dt: float = TICK_SECONDS,
) -> SimulationState:
    """Play one arrival sequence through one controller and return the state.

    The loop `tick_engine.py` will drive per session, without the socket: each
    tick advances the clock, admits whatever has arrived, asks the controller to
    step, and discharges what the controller has green. Feeding the *same*
    `arrivals` to two controllers is how the benchmark compares them on identical
    traffic rather than on two runs that merely looked similar.
    """
    ordered = sorted(arrivals, key=lambda arrival: arrival.t)
    if duration is None:
        duration = ordered[-1].t + dt if ordered else 0.0

    state = SimulationState()
    index = 0

    while state.clock + dt <= duration + 1e-9:
        state.clock += dt
        # `<=` so a warm-up arrival stamped at t=0 is admitted on the first tick
        # rather than being stranded outside the loop.
        while index < len(ordered) and ordered[index].t <= state.clock:
            state.admit(ordered[index])
            index += 1

        controller.step(dt, state)
        state.discharge(dt, controller.aspects())
        state.observe_peak()

    return state
