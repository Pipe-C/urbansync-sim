"""SimulationSession — one run of the junction.

The shape matches `SessionRecord` in `frontend/src/store/sessionsStore.ts`,
which is the object the reports screen already renders and which is explicitly
documented there as "what survives the swap" from the local log to the backend.
The two `adaptive`/`fixed` summaries live in `simulation_reports`, not here, so
this row stays a description of the run rather than a copy of its results.
"""

import uuid
from datetime import datetime

from sqlalchemy import Float, ForeignKey, Integer, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UTCDateTime
from app.models.enums import ControlMode, SimulationStatus, enum_column
from app.models.simulation_config import SimulationConfig
from app.models.simulation_metric import SimulationMetric


class SimulationSession(Base, TimestampMixin):
    __tablename__ = "simulation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # Nullable: `/observer` runs publicly with no account, and a run that
    # happened is still evidence even when nobody signed in to start it.
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)

    # The configuration the run was started with, kept as a snapshot so editing
    # the saved config later cannot retroactively change what a past run used.
    config_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("simulation_configs.id"))
    config: Mapped[SimulationConfig | None] = relationship(lazy="selectin")

    mode: Mapped[ControlMode] = mapped_column(
        enum_column(ControlMode, name="control_mode", length=16), nullable=False
    )
    status: Mapped[SimulationStatus] = mapped_column(
        enum_column(SimulationStatus, name="simulation_status", length=16),
        default=SimulationStatus.RUNNING,
        nullable=False,
    )

    started_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    tick_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    vehicles_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Deleting a run removes its samples: the samples have no meaning apart from
    # the run they measured, and orphans would be rows nothing can interpret.
    metrics: Mapped[list[SimulationMetric]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="SimulationMetric.tick"
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<SimulationSession {self.id} {self.status}>"
