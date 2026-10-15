"""SimulationMetric — one strategy's reading for one sample window.

The columns are `StrategyFrame` from `frontend/src/types/metrics.ts`: the four
quantities a control strategy is judged on, kept together because they move
together. A table that stored only the wait time would let a later query average
it across runs with no way to tell which of the runs had starved a queue to get
the number down.
"""

import uuid

from sqlalchemy import Float, ForeignKey, Integer, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import ControlMode, enum_column


class SimulationMetric(Base):
    __tablename__ = "simulation_metrics"
    __table_args__ = (
        # One reading per strategy per window. A duplicate tick is a bug in the
        # writer, and the constraint turns a silent double-count into an error.
        UniqueConstraint("session_id", "tick", "strategy", name="uq_metric_session_tick_strategy"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("simulation_sessions.id"), index=True, nullable=False
    )

    tick: Mapped[int] = mapped_column(Integer, nullable=False)
    # Elapsed seconds since the run started, so a report can plot without
    # assuming the tick length.
    t: Mapped[float] = mapped_column(Float, nullable=False)

    strategy: Mapped[ControlMode] = mapped_column(
        enum_column(ControlMode, name="control_mode", length=16), nullable=False
    )

    average_wait_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    throughput_per_minute: Mapped[float] = mapped_column(Float, nullable=False)
    emergency_response_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    longest_queue: Mapped[int] = mapped_column(Integer, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<SimulationMetric session={self.session_id} tick={self.tick} {self.strategy}>"
