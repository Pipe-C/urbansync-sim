"""SimulationReport — the consolidated comparison for one finished run.

This is the row the reports screen and the eventual PDF/CSV export read, and it
is where the product's claim is finally written down: the same run's wait,
throughput, emergency response and longest queue under the adaptive controller
and under the fixed cycle, side by side.

It is a separate table from `simulation_metrics` on purpose. The metrics are the
evidence — hundreds of rows nobody reads directly. The report is the conclusion,
computed once when the run ends, so a report endpoint is a single row fetch
rather than a full aggregate over the session's samples on every request.
"""

import uuid
from datetime import datetime

from sqlalchemy import Float, ForeignKey, Integer, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UTCDateTime
from app.models.simulation_session import SimulationSession


class SimulationReport(Base):
    __tablename__ = "simulation_reports"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("simulation_sessions.id"), unique=True, nullable=False
    )
    # The report is written as `SimulationReport(session=run, …)` before the run
    # has a primary key (the id is assigned at flush), so it is attached through
    # the relationship rather than by a `session_id` that does not exist yet.
    session: Mapped[SimulationSession] = relationship()

    # Adaptive and fixed summaries are columns rather than a child table because
    # there are exactly two strategies and the whole value of the report is that
    # they sit next to each other.
    adaptive_average_wait_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    adaptive_throughput_per_minute: Mapped[float] = mapped_column(Float, nullable=False)
    adaptive_emergency_response_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    adaptive_longest_queue: Mapped[int] = mapped_column(Integer, nullable=False)

    fixed_average_wait_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    fixed_throughput_per_minute: Mapped[float] = mapped_column(Float, nullable=False)
    fixed_emergency_response_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    fixed_longest_queue: Mapped[int] = mapped_column(Integer, nullable=False)

    vehicles_processed: Mapped[int] = mapped_column(Integer, nullable=False)

    generated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<SimulationReport session={self.session_id}>"
