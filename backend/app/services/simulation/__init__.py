"""The simulation model: state, arrivals, and (later) the per-session ticker.

Everything here is a pure model with no transport, no socket and no database in
the loop — the same boundary the frontend's `src/simulation/core/` draws. That is
what lets the control law be exercised in a unit test in a few milliseconds,
across many seeds, without a browser or a running server in the way.
"""

from app.services.simulation.state import (
    ARMS,
    OPPOSITE,
    Arm,
    Arrival,
    Metrics,
    SimulationState,
    Vehicle,
    run,
)
from app.services.simulation.vehicle_generator import GeneratorConfig, generate

__all__ = [
    "ARMS",
    "OPPOSITE",
    "Arm",
    "Arrival",
    "GeneratorConfig",
    "Metrics",
    "SimulationState",
    "Vehicle",
    "generate",
    "run",
]
