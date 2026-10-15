"""Simulation-session request/response bodies.

`SimulationSessionCreate` is `SessionRecord` from the frontend's
`sessionsStore.ts` — the object the reports screen already builds when a run
stops. Sending it here is the whole point of Phase 2 for that screen: the shape
does not change when the local log becomes a real table.

The two strategy frames are optional on create. A finished run carries both (it
knows its readings); a run that is still going carries neither, and the read
schema reports `null` for them rather than a zero, because "not measured yet" and
"measured at zero" are different claims.
"""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.enums import ControlMode, SimulationStatus
from app.schemas.base import CamelModel


class StrategyFrame(CamelModel):
    """Mirrors `StrategyFrame` in frontend/src/types/metrics.ts."""

    average_wait_seconds: float = Field(ge=0)
    throughput_per_minute: float = Field(ge=0)
    emergency_response_seconds: float = Field(ge=0)
    longest_queue: int = Field(ge=0)


class SimulationSessionCreate(CamelModel):
    started_at: datetime
    finished_at: datetime | None = None
    duration_seconds: float | None = Field(default=None, ge=0)
    tick_count: int = Field(default=0, ge=0)
    mode: ControlMode
    vehicles_processed: int = Field(default=0, ge=0)
    config_id: UUID | None = None

    # Present together or not at all — a run cannot have measured one strategy
    # and not the other, since both are generated from the same traffic.
    adaptive: StrategyFrame | None = None
    fixed: StrategyFrame | None = None

    def has_report(self) -> bool:
        return self.adaptive is not None and self.fixed is not None


class SimulationSessionUpdate(CamelModel):
    """The fields a run updates while it is alive. Everything else is set at
    creation; `status` is how a run is marked finished or aborted."""

    status: SimulationStatus | None = None
    finished_at: datetime | None = None
    duration_seconds: float | None = Field(default=None, ge=0)
    tick_count: int | None = Field(default=None, ge=0)
    vehicles_processed: int | None = Field(default=None, ge=0)


class SimulationSessionRead(CamelModel):
    id: UUID
    mode: ControlMode
    status: SimulationStatus
    started_at: datetime
    finished_at: datetime | None
    duration_seconds: float | None
    tick_count: int
    vehicles_processed: int
    config_id: UUID | None
    adaptive: StrategyFrame | None
    fixed: StrategyFrame | None
    created_at: datetime
