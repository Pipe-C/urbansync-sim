"""The session hub: which runs are alive, and how they end.

The socket handlers themselves are thin enough to read; what needs pinning is the
*lifecycle*, which is why it lives in the hub and not in `server.py`. These tests
drive the hub with a recorder in place of the socket and a sleep that yields
without waiting, so a run reaches its horizon in a test without taking its time in
real seconds. What they assert is the set of promises the transport depends on: an
event reaches the room under its session id, a restart replaces rather than races,
a stop cancels without a false `session_ended`, and capacity is bounded because
the stream is unauthenticated.
"""

from __future__ import annotations

import asyncio

import pytest
from pydantic import ValidationError

from app.api.ws.hub import HubAtCapacity, SessionHub, engine_config
from app.models.enums import ControlMode
from app.schemas.stream import SimulationStreamRequest
from app.services.simulation.tick_engine import EngineConfig
from app.services.simulation.vehicle_generator import DEFAULT_TYPE_WEIGHTS


async def _no_wait(_interval: float) -> None:
    """Yields control without pausing, so cancellation is still observable."""
    await asyncio.sleep(0)


class _Recorder:
    """Stands in for the socket: records every (session, kind, payload) emitted."""

    def __init__(self) -> None:
        self.events: list[tuple[str, str, dict]] = []

    async def __call__(self, session_id: str, kind: str, payload: dict) -> None:
        self.events.append((session_id, kind, payload))

    @property
    def kinds(self) -> list[str]:
        return [kind for _, kind, _ in self.events]


def _config(session_id: str = "run-1", **overrides: object) -> EngineConfig:
    base: dict[str, object] = {
        "session_id": session_id,
        "quiet_rate_per_minute": 30.0,
        "type_weights": dict(DEFAULT_TYPE_WEIGHTS),
        "mode": ControlMode.ADAPTIVE,
        "seed": 20260929,
        "duration": 1.0,
    }
    base.update(overrides)
    return EngineConfig(**base)  # type: ignore[arg-type]


async def test_a_started_run_streams_each_event_to_its_session() -> None:
    recorder = _Recorder()
    hub = SessionHub(recorder, sleep=_no_wait)

    await hub.start(_config(duration=1.0))
    assert hub.is_running("run-1")

    await hub.wait("run-1")

    assert recorder.kinds[0] == "tick"
    assert recorder.kinds[-1] == "session_ended"
    assert recorder.kinds.count("tick") == 10  # one second at the 100 ms tick
    assert {session_id for session_id, _, _ in recorder.events} == {"run-1"}
    assert "metrics" in recorder.events[0][2]
    assert not hub.is_running("run-1")


async def test_starting_again_replaces_the_run_it_replaces() -> None:
    recorder = _Recorder()
    hub = SessionHub(recorder, sleep=_no_wait)

    await hub.start(_config(duration=100.0))
    await hub.start(_config(duration=100.0))

    # One run for the id, not two racing over the same room.
    assert hub.running() == ("run-1",)
    await hub.stop_all()


async def test_stopping_cancels_a_run_without_ending_it() -> None:
    recorder = _Recorder()
    hub = SessionHub(recorder, sleep=_no_wait)

    await hub.start(_config(duration=100.0))
    await asyncio.sleep(0)  # let the task take its first steps
    assert hub.is_running("run-1")

    await hub.stop("run-1")

    assert not hub.is_running("run-1")
    # A cancelled run did not reach its horizon, so it must not claim it did.
    assert "session_ended" not in recorder.kinds


async def test_capacity_is_bounded() -> None:
    hub = SessionHub(_Recorder(), max_runs=1, sleep=_no_wait)

    await hub.start(_config("run-1", duration=100.0))
    with pytest.raises(HubAtCapacity):
        await hub.start(_config("run-2", duration=100.0))

    await hub.stop_all()


async def test_stop_all_ends_every_run() -> None:
    hub = SessionHub(_Recorder(), sleep=_no_wait)

    await hub.start(_config("run-1", duration=100.0))
    await hub.start(_config("run-2", duration=100.0))
    assert set(hub.running()) == {"run-1", "run-2"}

    await hub.stop_all()

    assert hub.running() == ()


async def test_stopping_an_idle_session_is_a_no_op() -> None:
    hub = SessionHub(_Recorder(), sleep=_no_wait)

    await hub.stop("never-started")

    assert hub.running() == ()


def test_engine_config_maps_the_stream_request() -> None:
    request = SimulationStreamRequest.model_validate(
        {
            "sessionId": "run-9",
            "config": {
                "quietRatePerMinute": 42,
                "typeWeights": {"sedan": 10, "hatchback": 5, "taxi": 1, "van": 1, "bus": 1},
                "mode": "fixed",
            },
        }
    )

    config = engine_config(request, duration=60.0)

    assert config.session_id == "run-9"
    assert config.quiet_rate_per_minute == 42
    assert config.mode is ControlMode.FIXED
    assert config.type_weights["sedan"] == 10
    assert config.duration == 60.0


def test_the_stream_schema_refuses_an_empty_mix() -> None:
    """The same boundary the REST config schema enforces, kept here so a socket
    client cannot start a run on an empty junction either."""
    with pytest.raises(ValidationError):
        SimulationStreamRequest.model_validate(
            {
                "sessionId": "run-1",
                "config": {
                    "quietRatePerMinute": 42,
                    "mode": "adaptive",
                    "typeWeights": {
                        "sedan": 0,
                        "hatchback": 0,
                        "taxi": 0,
                        "van": 0,
                        "bus": 0,
                    },
                },
            }
        )
