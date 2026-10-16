"""The Phase 3 control core: state, generator, and both controllers.

The tests come in three kinds, and the split is the point:

- The pressure and discharge tests pin the model's arithmetic, so the number the
  dashboard will eventually show is a claim with a test behind it.
- The controller tests pin the *decisions* — the interlock, the ceiling, the
  starvation bound, preemption — by driving one state machine forward and reading
  its phase back, with no run and no socket.
- The benchmark test is the product's thesis: the same arrival sequence through
  both controllers, adaptive ahead of fixed. If that test ever goes red, the
  project's central claim is no longer true and no amount of green CI matters.
"""

from app.services.algorithm import (
    ALL_RED,
    AMBER,
    MAX_GREEN,
    MIN_GREEN,
    AdaptiveController,
    FixedController,
    PhaseKind,
)
from app.services.algorithm.fixed_controller import FIXED_GREEN
from app.services.simulation import Arm, Arrival, GeneratorConfig, SimulationState, generate, run
from app.services.simulation.state import LANES_PER_ARM, Aspect


def _state(clock: float = 0.0, waits: dict[Arm, list[float]] | None = None) -> SimulationState:
    """A state whose queued vehicles have been waiting the given seconds.

    `pressure` measures `clock - arrived_at`, so a vehicle that must read as
    having waited `w` is admitted with `arrived_at = clock - w`.
    """
    state = SimulationState()
    state.clock = clock
    for arm, waited in (waits or {}).items():
        for index, seconds in enumerate(waited):
            state.admit(
                Arrival(
                    t=clock - seconds,
                    arm=arm,
                    lane=index % LANES_PER_ARM,
                    kind="sedan",
                )
            )
    return state


def _drive_to_green(controller, state, dt: float = 0.1, limit: int = 1000) -> None:
    for _ in range(limit):
        controller.step(dt, state)
        if controller.phase.kind is PhaseKind.GREEN:
            return
    raise AssertionError("the controller never reached a green")


# --- the model's arithmetic ----------------------------------------------------


def test_pressure_matches_the_browser_formula() -> None:
    """`Σ (1 + waited/12)`: a just-arrived car counts 1, one that has waited twelve
    seconds counts 2."""
    state = _state(clock=20.0, waits={Arm.NORTH: [0.0, 12.0]})

    assert state.pressure(Arm.NORTH) == 3.0


def test_pressure_caps_a_wait_at_the_horizon() -> None:
    """Past two minutes the wait carries no more information, so it is not allowed
    to keep inflating one vehicle's claim on the green."""
    state = _state(clock=500.0, waits={Arm.NORTH: [500.0]})

    assert state.pressure(Arm.NORTH) == 1.0 + 120.0 / 12.0


def test_an_empty_approach_has_no_pressure() -> None:
    assert _state().pressure(Arm.WEST) == 0.0


def test_discharge_clears_a_queue_at_the_saturation_headway() -> None:
    """A queue leaves one vehicle every two seconds of green, not all at once."""
    state = _state()
    for _ in range(4):
        state.admit(Arrival(t=0.0, arm=Arm.NORTH, lane=0, kind="sedan"))
    green = {Arm.NORTH: Aspect.GREEN, Arm.SOUTH: Aspect.GREEN}

    # First tick discharges the car at the line; the next is two seconds later.
    state.discharge(0.1, green)
    assert state.served == 1
    for _ in range(18):
        state.discharge(0.1, green)
    assert state.served == 1
    state.discharge(0.1, green)
    assert state.served == 2


def test_a_red_cancels_an_accrued_headway() -> None:
    """The next green must clear the car at the line immediately rather than
    finish a countdown that belonged to a phase now over."""
    state = _state(waits={Arm.NORTH: [0.0]})
    state.discharge(1.0, {Arm.NORTH: Aspect.RED})
    state.discharge(0.1, {Arm.NORTH: Aspect.GREEN, Arm.SOUTH: Aspect.GREEN})

    assert state.served == 1


# --- the adaptive controller ---------------------------------------------------


def test_a_green_serves_the_whole_axis() -> None:
    controller = AdaptiveController()
    state = _state(waits={Arm.NORTH: [5.0]})
    _drive_to_green(controller, state)

    aspects = controller.aspects()
    assert aspects[Arm.NORTH] == Aspect.GREEN
    assert aspects[Arm.SOUTH] == Aspect.GREEN
    assert aspects[Arm.EAST] == Aspect.RED
    assert aspects[Arm.WEST] == Aspect.RED


def test_the_busiest_approach_is_served_first() -> None:
    controller = AdaptiveController()
    state = _state(waits={Arm.NORTH: [1.0], Arm.EAST: [40.0]})
    _drive_to_green(controller, state)

    assert controller.phase.arm in (Arm.EAST, Arm.WEST)
    assert "presión" in controller.phase.reason


def test_a_green_is_held_for_the_minimum_even_when_outbid() -> None:
    controller = AdaptiveController()
    state = _state(clock=100.0, waits={Arm.NORTH: [5.0]})
    _drive_to_green(controller, state)
    assert controller.phase.arm in (Arm.NORTH, Arm.SOUTH)

    # A flood on the other axis. It cannot end the green before the floor.
    for index in range(6):
        state.admit(Arrival(t=0.0, arm=Arm.EAST, lane=index % LANES_PER_ARM, kind="bus"))
    for _ in range(int(MIN_GREEN) - 1):
        controller.step(1.0, state)
    assert controller.phase.kind is PhaseKind.GREEN
    assert controller.phase.arm in (Arm.NORTH, Arm.SOUTH)

    # Past the floor, the flood takes the phase.
    controller.step(1.0, state)
    assert controller.phase.kind is PhaseKind.AMBER


def test_a_green_yields_at_the_maximum() -> None:
    controller = AdaptiveController()
    # Every vehicle on one axis, and the queue never drains (the controller is
    # stepped alone), so only the ceiling can end the green.
    state = _state(waits={Arm.NORTH: [30.0]})
    _drive_to_green(controller, state)

    for _ in range(int(MAX_GREEN) - 1):
        controller.step(1.0, state)
    assert controller.phase.kind is PhaseKind.GREEN

    controller.step(1.0, state)
    assert controller.phase.kind is PhaseKind.AMBER
    assert "máximo" in controller.phase.reason


def test_a_starved_approach_is_served_despite_lower_pressure() -> None:
    """The bound, not the pressure, is what stops one arm capturing the junction."""
    controller = AdaptiveController()
    state = _state(waits={Arm.NORTH: [30.0]})

    served_arms: set[Arm] = set()
    for _ in range(1200):  # two minutes of ticks
        controller.step(0.1, state)
        if controller.phase.kind is PhaseKind.GREEN:
            served_arms.add(controller.phase.arm)

    # North carries all the pressure; without the bound it would be the only arm
    # ever chosen.
    assert len(served_arms) >= 2
    assert controller.phase.arm is not None


def test_an_emergency_preempts_the_green() -> None:
    controller = AdaptiveController()
    state = _state(waits={Arm.NORTH: [30.0]})
    _drive_to_green(controller, state)
    assert controller.phase.arm in (Arm.NORTH, Arm.SOUTH)

    state.admit(Arrival(t=state.clock, arm=Arm.EAST, lane=0, kind="ambulance", emergency=True))
    controller.step(0.1, state)

    assert controller.phase.kind is PhaseKind.AMBER
    assert "Preempti" in controller.phase.reason

    # Through amber and all-red, the emergency approach is served.
    for _ in range(int((AMBER + ALL_RED) / 0.1) + 5):
        controller.step(0.1, state)
    assert controller.phase.kind is PhaseKind.GREEN
    assert controller.phase.arm in (Arm.EAST, Arm.WEST)


# --- the fixed reference -------------------------------------------------------


def test_a_fixed_cycle_alternates_the_axes_and_ignores_pressure() -> None:
    controller = FixedController()
    state = _state(waits={Arm.NORTH: [200.0]})  # pressure that adaptive would obey

    greens: list[Arm] = []
    for _ in range(int((FIXED_GREEN + AMBER + ALL_RED) * 2 / 0.1) + 20):
        was_green = controller.phase.kind is PhaseKind.GREEN
        controller.step(0.1, state)
        now_green = controller.phase.kind is PhaseKind.GREEN
        if now_green and not was_green:
            greens.append(controller.phase.arm)

    assert greens[:2] == [Arm.NORTH, Arm.EAST]


def test_a_fixed_cycle_does_not_preempt() -> None:
    controller = FixedController()
    state = _state(waits={Arm.NORTH: [5.0]})
    _drive_to_green(controller, state)
    assert controller.phase.arm is Arm.NORTH

    state.admit(Arrival(t=state.clock, arm=Arm.EAST, lane=0, kind="ambulance", emergency=True))
    assert controller.preemption_request(state) is None

    for _ in range(int(FIXED_GREEN) - 1):
        controller.step(1.0, state)
    assert controller.phase.kind is PhaseKind.GREEN
    assert controller.phase.arm is Arm.NORTH


# --- the generator -------------------------------------------------------------


def _config(**overrides: object) -> GeneratorConfig:
    base = GeneratorConfig(
        quiet_rate_per_minute=55.0,
        type_weights={"sedan": 30, "hatchback": 22, "taxi": 13, "van": 15, "bus": 6},
        seed=20260929,
    )
    for key, value in overrides.items():
        setattr(base, key, value)
    return base


def test_the_generator_is_deterministic() -> None:
    assert generate(_config(), 300.0) == generate(_config(), 300.0)


def test_a_zero_weight_removes_a_kind() -> None:
    arrivals = generate(
        _config(type_weights={"sedan": 10, "hatchback": 0, "taxi": 0, "van": 0, "bus": 0}),
        300.0,
    )

    ordinary = {a.kind for a in arrivals if not a.emergency}
    assert ordinary <= {"sedan", "police"}
    assert "sedan" in ordinary


def test_the_warm_up_prefills_every_lane() -> None:
    arrivals = generate(_config(), 60.0)

    at_zero = [a for a in arrivals if a.t == 0.0]
    assert len(at_zero) == (3 + 2 + 2 + 2) * LANES_PER_ARM


def test_emergency_kinds_alternate() -> None:
    arrivals = generate(_config(), 400.0)
    kinds = [a.kind for a in arrivals if a.emergency]

    assert len(kinds) >= 2
    assert kinds[0] == "ambulance"
    assert kinds == ["ambulance" if i % 2 == 0 else "firetruck" for i in range(len(kinds))]


# --- the benchmark: the product's thesis ---------------------------------------


def test_adaptive_beats_fixed_on_the_same_sequence() -> None:
    """Same vehicles, same clock, same interlocks — only the decision differs.

    Run over several seeds rather than one, because a single seed would let a
    lucky draw stand in for the claim. The demand is asymmetric (a busy avenue
    cross a quiet street) and deliberately below the junction's capacity: near or
    over saturation both controllers leave queues that never drain, the average
    wait grows without bound, and the comparison stops being about the policy. The
    benchmark's regime is the one the product is for — a signal that can actually
    clear its queues, given the chance.
    """
    skew = {Arm.NORTH: 2.0, Arm.SOUTH: 2.0, Arm.EAST: 0.6, Arm.WEST: 0.6}

    for seed in (20260929, 7, 42):
        arrivals = generate(_config(quiet_rate_per_minute=30.0, arm_weights=skew, seed=seed), 600.0)

        adaptive = run(arrivals, AdaptiveController()).snapshot()
        fixed = run(arrivals, FixedController()).snapshot()

        assert adaptive.average_wait_seconds < fixed.average_wait_seconds, seed
        # Preemption is the asymmetry, and it shows where the product says it does:
        # a fixed signal serves an ambulance in its turn, however long that is.
        assert adaptive.emergency_response_seconds < fixed.emergency_response_seconds, seed
        # And it is not buying the shorter wait by starving throughput.
        assert adaptive.throughput_per_minute >= fixed.throughput_per_minute, seed
