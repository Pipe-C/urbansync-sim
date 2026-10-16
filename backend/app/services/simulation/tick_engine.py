"""The engine: one run of the junction, advanced a tick at a time.

`state.run` plays a whole arrival sequence in a loop and returns the end. A live
session cannot do that — it has to hand out each tick while the run is still going,
so the socket can stream it and the dashboard can draw it. This module is that loop
turned inside out: `SimulationEngine.step` advances exactly one tick and returns the
events that tick produced, and `run_session` drives it at wall-clock pace.

It is the backend's `world.ts`: the one place that pairs a policy with the model it
acts on, and so the one place that knows both an algorithm and a state. The model
stays ignorant of controllers, and the controllers stay ignorant of the socket. The
events named here are the vocabulary `PLAN.md`'s Phase 4 will put on the wire —
`tick`, `phase_change`, `evp_activated`, `session_ended` — decided now, next to the
engine that raises them, rather than in the handler that happens to forward them.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from app.models.enums import ControlMode
from app.services.algorithm import AdaptiveController, FixedController, SignalController
from app.services.simulation.state import ARMS, SimulationState, TICK_SECONDS
from app.services.simulation.vehicle_generator import (
    DEFAULT_SEED,
    GeneratorConfig,
    generate,
)

#: A reading of the junction this tick — phase, aspects, queues, running metrics.
TICK = "tick"
#: The phase moved. Carries the new phase and the reason the controller gives it.
PHASE_CHANGE = "phase_change"
#: A policy started preempting for an emergency vehicle. Raised on the rising edge
#: only: clearance shows up as the absence of it on the ticks that follow.
EVP_ACTIVATED = "evp_activated"
#: The run reached its horizon. The last event a session produces.
SESSION_ENDED = "session_ended"


@dataclass(frozen=True)
class EngineEvent:
    """One thing that happened this tick, ready to serialise onto the socket.

    `payload` is a plain JSON-shaped dict with camelCase keys, because the same
    objects are the REST response's vocabulary (`StrategyFrame`) and a session
    stream should not be a second dialect of it.
    """

    kind: str
    payload: dict[str, Any]


@dataclass(frozen=True)
class EngineConfig:
    """Everything a session needs to build its run from an operator's config."""

    session_id: str
    quiet_rate_per_minute: float
    type_weights: dict[str, float]
    mode: ControlMode = ControlMode.ADAPTIVE
    seed: int = DEFAULT_SEED
    #: Seconds the run lasts. Long enough that a demo is not interrupted, finite so
    #: every run has an end the socket can announce.
    duration: float = 1800.0
    dt: float = TICK_SECONDS


def _controller_for(mode: ControlMode) -> SignalController:
    """The one decision the mode makes: which policy drives the state machine."""
    if mode is ControlMode.FIXED:
        return FixedController()
    return AdaptiveController()


def _generator_config(config: EngineConfig) -> GeneratorConfig:
    return GeneratorConfig(
        quiet_rate_per_minute=config.quiet_rate_per_minute,
        type_weights=config.type_weights,
        seed=config.seed,
    )


class SimulationEngine:
    """A single run of the junction, one tick at a time.

    Construct it from an `EngineConfig` and call `step` until `finished`. Pass
    `arrivals` to drive it with a fixed sequence instead of a generated one, which
    is what lets a test place an ambulance exactly where it wants one.
    """

    def __init__(self, config: EngineConfig, *, arrivals: list | None = None) -> None:
        self._config = config
        self._state = SimulationState()
        self._controller = _controller_for(config.mode)
        source = generate(_generator_config(config), config.duration) if arrivals is None else arrivals
        self._arrivals = sorted(source, key=lambda arrival: arrival.t)
        self._cursor = 0
        self._tick = 0
        self._finished = False
        #: `None` until the first tick has been recorded, so the run's opening
        #: phase is not announced as a change from nothing.
        self._last_phase: tuple[str, str | None] | None = None
        self._preempted = False

    # --- inspection ------------------------------------------------------------

    @property
    def config(self) -> EngineConfig:
        return self._config

    @property
    def state(self) -> SimulationState:
        return self._state

    @property
    def finished(self) -> bool:
        return self._finished

    @property
    def tick(self) -> int:
        return self._tick

    def snapshot(self) -> dict[str, Any]:
        """The junction right now, as the payload a `tick` event carries."""
        phases = self._controller.aspects()
        metrics = self._state.snapshot()
        preempting_arm = self._controller.preemption_request(self._state)
        return {
            "tick": self._tick,
            "t": round(self._state.clock, 3),
            "phase": self._phase_payload(),
            "aspects": {arm.value: phases[arm].value for arm in ARMS},
            "queues": {arm.value: self._state.queued(arm) for arm in ARMS},
            "preemption": preempting_arm.value if preempting_arm is not None else None,
            "metrics": {
                "averageWaitSeconds": round(metrics.average_wait_seconds, 3),
                "throughputPerMinute": round(metrics.throughput_per_minute, 3),
                "emergencyResponseSeconds": round(metrics.emergency_response_seconds, 3),
                "longestQueue": metrics.longest_queue,
            },
        }

    # --- the tick --------------------------------------------------------------

    def step(self) -> list[EngineEvent]:
        """Advance one tick and return the events it produced.

        Empty once the run is over, so a driver can keep calling it without a
        guard — the run announces its own end and then stops producing.
        """
        if self._finished:
            return []

        dt = self._config.dt
        self._state.clock += dt
        # `<=` so a warm-up arrival stamped at t=0 is admitted on the first tick.
        while self._cursor < len(self._arrivals) and self._arrivals[self._cursor].t <= self._state.clock:
            self._state.admit(self._arrivals[self._cursor])
            self._cursor += 1

        self._controller.step(dt, self._state)
        self._state.discharge(dt, self._controller.aspects())
        self._state.observe_peak()
        self._tick += 1

        events = self._transitions()
        events.append(EngineEvent(TICK, self.snapshot()))

        if self._state.clock + dt > self._config.duration + 1e-9:
            self._finished = True
            events.append(
                EngineEvent(
                    SESSION_ENDED,
                    {**self.snapshot(), "vehiclesProcessed": self._state.served},
                )
            )
        return events

    def _transitions(self) -> list[EngineEvent]:
        """The phase change and the preemption edge, if this tick produced one."""
        events: list[EngineEvent] = []

        phase = self._controller.phase
        key = (phase.kind.value, phase.arm.value if phase.arm is not None else None)
        if self._last_phase is None:
            self._last_phase = key
        elif key != self._last_phase:
            self._last_phase = key
            events.append(
                EngineEvent(
                    PHASE_CHANGE,
                    {"tick": self._tick, "t": round(self._state.clock, 3), "phase": self._phase_payload()},
                )
            )

        # The *policy's* request, not the model's raw fact: a fixed signal ignores an
        # ambulance, so it must not report that it is preempting for one.
        requested = self._controller.preemption_request(self._state)
        if requested is not None and not self._preempted:
            events.append(
                EngineEvent(
                    EVP_ACTIVATED,
                    {"tick": self._tick, "t": round(self._state.clock, 3), "arm": requested.value},
                )
            )
        self._preempted = requested is not None
        return events

    def _phase_payload(self) -> dict[str, Any]:
        phase = self._controller.phase
        return {
            "kind": phase.kind.value,
            "arm": phase.arm.value if phase.arm is not None else None,
            "reason": phase.reason,
        }


#: Where the engine's events go. The socket handler supplies one that emits; a test
#: supplies one that appends to a list.
Sink = Callable[[EngineEvent], Awaitable[None]]


async def run_session(
    engine: SimulationEngine,
    sink: Sink,
    *,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
) -> None:
    """Drive `engine` to its horizon, handing every event to `sink`.

    The wall clock is not this function's concern beyond `sleep`, which is why it is
    a parameter: a test passes one that yields without waiting, and a caller that
    wants a faster-than-real-time replay passes a shorter interval, without either
    changing the engine. `run_session` owns pacing; `SimulationEngine` owns
    arithmetic.
    """
    while not engine.finished:
        for event in engine.step():
            await sink(event)
        if not engine.finished:
            await sleep(engine.config.dt)
