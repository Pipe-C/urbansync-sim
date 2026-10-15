"""SimulationConfig — the operator's parameters, saved and reusable.

The shape mirrors `SimulationConfig` in `frontend/src/types/config.ts` exactly:
`quietRatePerMinute`, five `typeWeights`, and a `mode`. The bounds live in the
Pydantic schema (`app/schemas/config.py`) and are the same bounds the frontend
enforces with Zod before it ever sends the payload.

`type_weights` is stored as a JSON object keyed by vehicle kind. It is a small,
free-form map whose keys are the frontend's business — promoting it to a table
with a row per kind would buy nothing and make "every weight at once" five reads.
"""

import uuid

from sqlalchemy import Float, ForeignKey, JSON, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import ControlMode, enum_column

# JSONB on PostgreSQL (indexable, canonical key order), JSON everywhere else so
# the same model runs under the SQLite used by the test suite.
TypeWeights = JSON().with_variant(JSONB, "postgresql")


class SimulationConfig(Base, TimestampMixin):
    __tablename__ = "simulation_configs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # Nullable because an observer can save a configuration without an account.
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)

    name: Mapped[str | None] = mapped_column(String(120))

    quiet_rate_per_minute: Mapped[float] = mapped_column(Float, nullable=False)
    type_weights: Mapped[dict[str, float]] = mapped_column(TypeWeights, nullable=False)
    mode: Mapped[ControlMode] = mapped_column(
        enum_column(ControlMode, name="control_mode", length=16), nullable=False
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<SimulationConfig {self.id} mode={self.mode}>"
