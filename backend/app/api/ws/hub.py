"""The hub: which sessions are running, and the tasks that stream them.

`tick_engine.SessionEngine.step` advances one run by a tick; something has to own
the task, key it by session, pace it, and hand its events to the transport. That is
this module — and it holds no reference to Socket.io on purpose. Its `emit` is a
parameter, so the hub can be tested by handing it a list and asserting what landed
there, with no socket, no event loop beyond the one the test already runs on, and
no waiting in real time (a test passes a `sleep` that yields without pausing).

The transport (the socket handlers) is therefore thin: it validates a payload,
builds an `EngineConfig`, and starts, pauses or stops a run. Everything that could
be wrong about *lifecycle* — a run replaced by a new config, a run cancelled, a run
that reached its horizon and freed itself, a paused run that must not advance,
too many runs — is decided here, where it can be read and tested in one place.
"""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import Awaitable, Callable
from typing import Any

from app.schemas.stream import SimulationStreamRequest
from app.services.simulation.tick_engine import (
    EngineConfig,
    EngineEvent,
    SessionEngine,
)

#: How the hub talks to the transport. Not `Sink`: this speaks the session's
#: identity and an event's name and body, which is the socket's vocabulary, and
#: deliberately not the engine's `EngineEvent` — the hub is the seam between them.
Emit = Callable[[str, str, dict[str, Any]], Awaitable[None]]

#: How long a streamed run lasts. Long enough that a demo is not cut off, finite so
#: every run frees its task. The engine has the same default; stated here because a
#: streamed session is the case that actually reaches it.
DEFAULT_STREAM_DURATION = 1800.0

#: Pacing, injectable for the same reason `run_session`'s is: a test should not
#: spend a minute streaming a minute of traffic.
Sleep = Callable[[float], Awaitable[None]]


class HubAtCapacity(RuntimeError):
    """Raised when a new run is asked for and the hub is already at its limit.

    The socket stream is unauthenticated, so starting a run is something any
    client can ask for; the cap is what stops that from being an unbounded number
    of ten-hertz tasks.
    """


def engine_config(
    request: SimulationStreamRequest,
    *,
    duration: float = DEFAULT_STREAM_DURATION,
) -> EngineConfig:
    """The operator's configuration as the engine's own config."""
    config = request.config
    return EngineConfig(
        session_id=request.session_id,
        quiet_rate_per_minute=config.quiet_rate_per_minute,
        type_weights=config.type_weights.model_dump(),
        mode=config.mode,
        duration=duration,
    )


class SessionHub:
    """Owns one background task per running session.

    A run is keyed by session id and there is at most one per id: `start` replaces
    a running one, so re-submitting a configuration restarts the run rather than
    racing two engines over the same room. A run removes itself when it reaches its
    horizon, and `stop` cancels it early — both leave the hub empty of that id.
    """

    def __init__(
        self,
        emit: Emit,
        *,
        max_runs: int = 8,
        sleep: Sleep = asyncio.sleep,
    ) -> None:
        self._emit = emit
        self._max_runs = max_runs
        self._sleep = sleep
        self._runs: dict[str, asyncio.Task[None]] = {}
        self._engines: dict[str, SessionEngine] = {}
        #: One gate per run: set while it may advance, cleared while it is paused.
        #: The task waits on it between ticks, so a pause costs the engine nothing
        #: and a stop still cancels cleanly — a wait is cancellable, a busy loop is
        #: not.
        self._gates: dict[str, asyncio.Event] = {}

    def is_running(self, session_id: str) -> bool:
        return session_id in self._runs

    def is_paused(self, session_id: str) -> bool:
        """Whether the session's run exists and is held. A stopped session is not
        paused — it is gone, and a status reply must not confuse the two."""
        gate = self._gates.get(session_id)
        return gate is not None and not gate.is_set()

    def running(self) -> tuple[str, ...]:
        """The session ids with a live run, for a status reply and for tests."""
        return tuple(self._runs)

    def pause(self, session_id: str) -> None:
        """Hold the run where it is. Idempotent; a no-op for an idle session."""
        gate = self._gates.get(session_id)
        if gate is not None:
            gate.clear()

    def resume(self, session_id: str) -> None:
        """Let a paused run continue from the tick it stopped on."""
        gate = self._gates.get(session_id)
        if gate is not None:
            gate.set()

    async def start(self, config: EngineConfig) -> None:
        """Start a run, replacing any run already alive for the same session."""
        await self.stop(config.session_id)

        if len(self._runs) >= self._max_runs:
            raise HubAtCapacity(
                f"Demasiadas simulaciones en curso (máximo {self._max_runs}). "
                "Detén una antes de iniciar otra."
            )

        engine = SessionEngine(config)
        self._engines[config.session_id] = engine
        # Set before the task is created, because `_drive` reads it on its first
        # line; a run always starts live.
        gate = asyncio.Event()
        gate.set()
        self._gates[config.session_id] = gate
        self._runs[config.session_id] = asyncio.create_task(
            self._drive(config.session_id, engine)
        )

    async def stop(self, session_id: str) -> None:
        """Cancel the session's run and wait for it to unwind. Idempotent.

        The registry is cleared here rather than left to the task's `finally`,
        because a task cancelled before it ever runs never enters its coroutine
        and so has no `finally` to run — relying on it would leak the id.
        """
        task = self._runs.pop(session_id, None)
        self._engines.pop(session_id, None)
        self._gates.pop(session_id, None)
        if task is None:
            return
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

    async def wait(self, session_id: str) -> None:
        """Await a run to its natural end. Used by tests and orderly shutdown."""
        task = self._runs.get(session_id)
        if task is not None:
            with contextlib.suppress(asyncio.CancelledError):
                await task

    async def stop_all(self) -> None:
        for session_id in list(self._runs):
            await self.stop(session_id)

    async def _drive(self, session_id: str, engine: SessionEngine) -> None:
        async def sink(event: EngineEvent) -> None:
            await self._emit(session_id, event.kind, event.payload)

        gate = self._gates[session_id]
        try:
            while not engine.finished:
                # Blocks while paused, returns at once while running: the pause
                # lands on a tick boundary, which is the only place it can land.
                await gate.wait()
                for event in engine.step():
                    await sink(event)
                if not engine.finished:
                    await self._sleep(engine.config.dt)
        except asyncio.CancelledError:
            raise
        finally:
            # Only if this task is still the one registered: a restart could have
            # replaced the entry, and clearing it then would drop the new run.
            if self._runs.get(session_id) is asyncio.current_task():
                self._runs.pop(session_id, None)
                self._engines.pop(session_id, None)
                self._gates.pop(session_id, None)
