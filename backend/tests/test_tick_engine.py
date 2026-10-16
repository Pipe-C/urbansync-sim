"""The tick engine and the benchmark export.

Two things are pinned here. The engine's *contract* — one `tick` per step, a
`phase_change` only when the phase actually moves, an `evp_activated` on the rising
edge only, a single `session_ended` and then silence — because the Phase 4 socket
will forward these verbatim and a wrong edge becomes a wrong dashboard. And the
benchmark's *artifact* — `to_csv` has a header and both strategy columns — because
it is a Phase 3 deliverable, not a debug print.
"""

from __future__ import annotations

from app.models.enums import ControlMode
from app.services.simulation import Arm, Arrival
from app.services.simulation.benchmark import compare, to_csv
from app.services.simulation.tick_engine import (
    EVP_ACTIVATED,
    PHASE_CHANGE,
    SESSION_ENDED,
    TICK,
    EngineConfig,
    EngineEvent,
    SimulationEngine,
    run_session,
)
from app.services.simulation.vehicle_generator import (
    DEFAULT_TYPE_WEIGHTS,
    GeneratorConfig,
)


def _config(**overrides: object) -> EngineConfig:
    base: dict[str, object] = {
        "session_id": "test",
        "quiet_rate_per_minute": 55.0,
        "type_weights": dict(DEFAULT_TYPE_WEIGHTS),
        "mode": ControlMode.ADAPTIVE,
        "seed": 20260929,
        "duration": 120.0,
    }
    base.update(overrides)
    return EngineConfig(**base)  # type: ignore[arg-type]


def _generator_config(**overrides: object) -> GeneratorConfig:
    base: dict[str, object] = {
        "quiet_rate_per_minute": 30.0,
        "type_weights": dict(DEFAULT_TYPE_WEIGHTS),
        "seed": 20260929,
    }
    base.update(overrides)
    return GeneratorConfig(**base)  # type: ignore[arg-type]


def _drain(engine: SimulationEngine) -> list[EngineEvent]:
    events: list[EngineEvent] = []
    while not engine.finished:
        events.extend(engine.step())
    return events


# --- the tick contract ---------------------------------------------------------


def test_a_tick_carries_the_whole_junction() -> None:
    """The first tick announces nothing but itself: no change from an empty past,
    no emergency yet. Its payload is what the dashboard draws."""
    engine = SimulationEngine(_config(duration=5.0))
    events = engine.step()

    assert [event.kind for event in events] == [TICK]
    payload = events[0].payload
    assert payload["tick"] == 1
    assert set(payload["aspects"]) == {"north", "east", "south", "west"}
    assert set(payload["queues"]) == {"north", "east", "south", "west"}
    assert set(payload["metrics"]) == {
        "averageWaitSeconds",
        "throughputPerMinute",
        "emergencyResponseSeconds",
        "longestQueue",
    }


def test_a_phase_change_is_announced_once_per_transition() -> None:
    engine = SimulationEngine(_config(duration=120.0))

    changes = [
        event.payload["phase"]
        for event in _drain(engine)
        if event.kind == PHASE_CHANGE
    ]

    assert changes, "a two-minute run crosses several phases"
    keys = [(phase["kind"], phase["arm"]) for phase in changes]
    # No two consecutive changes are the same phase, and every change explains
    # itself — the reason string is the product's explainability claim.
    assert all(previous != current for previous, current in zip(keys, keys[1:]))
    assert all(phase["reason"] for phase in changes)


def test_preemption_is_announced_on_the_rising_edge() -> None:
    """One ambulance that has to wait is announced once, not once per tick while it
    waits. An emergency that arrives on an already-green approach is cleared on the
    spot and needs no preemption, so it is — correctly — not announced."""
    arrivals = [Arrival(t=0.5, arm=Arm.EAST, lane=0, kind="ambulance", emergency=True)]
    engine = SimulationEngine(_config(duration=20.0), arrivals=arrivals)

    activated = [
        event.payload["arm"] for event in _drain(engine) if event.kind == EVP_ACTIVATED
    ]

    assert activated == ["east"]


def test_a_fixed_engine_does_not_report_preemption() -> None:
    """The fixed reference ignores an ambulance, so it must not claim to be
    clearing one — the event follows the policy, not the vehicle's presence."""
    arrivals = [Arrival(t=0.5, arm=Arm.EAST, lane=0, kind="ambulance", emergency=True)]
    engine = SimulationEngine(
        _config(duration=20.0, mode=ControlMode.FIXED), arrivals=arrivals
    )

    kinds = [event.kind for event in _drain(engine)]
    assert EVP_ACTIVATED not in kinds


def test_the_run_ends_once_and_then_stays_silent() -> None:
    engine = SimulationEngine(_config(duration=1.0))
    events = _drain(engine)

    assert engine.finished
    assert [event.kind for event in events].count(SESSION_ENDED) == 1
    assert events[-1].kind == SESSION_ENDED
    assert events[-1].payload["vehiclesProcessed"] == engine.state.served
    assert engine.step() == []


def test_two_engines_with_one_config_agree() -> None:
    first = SimulationEngine(_config(duration=30.0))
    second = SimulationEngine(_config(duration=30.0))

    _drain(first)
    _drain(second)

    assert first.snapshot() == second.snapshot()


async def test_run_session_streams_the_whole_run() -> None:
    engine = SimulationEngine(_config(duration=1.0))
    received: list[EngineEvent] = []

    async def sink(event: EngineEvent) -> None:
        received.append(event)

    async def no_wait(_interval: float) -> None:
        return None

    await run_session(engine, sink, sleep=no_wait)

    assert engine.finished
    assert received[0].kind == TICK
    assert received[-1].kind == SESSION_ENDED


# --- the benchmark export ------------------------------------------------------


def test_the_benchmark_reports_both_strategies() -> None:
    comparison = compare(_generator_config(quiet_rate_per_minute=30.0), duration=120.0)

    assert comparison.arrivals > 0
    assert comparison.adaptive.average_wait_seconds > 0
    assert comparison.fixed.average_wait_seconds > 0


def test_the_csv_has_a_header_and_both_columns() -> None:
    text = to_csv(compare(_generator_config(quiet_rate_per_minute=30.0), duration=60.0))
    lines = text.strip().splitlines()

    assert lines[0] == "metric,adaptive,fixed"
    assert [line.split(",")[0] for line in lines[1:]] == [
        "averageWaitSeconds",
        "throughputPerMinute",
        "emergencyResponseSeconds",
        "longestQueue",
    ]
