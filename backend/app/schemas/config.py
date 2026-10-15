"""Configuration request/response bodies.

The bounds are the same ones `frontend/src/store/configStore.ts` enforces with
Zod, restated here because the client is not a security boundary: a request can
arrive from anywhere, and the server is the only place a constraint is actually
guaranteed. Keeping the two in agreement is deliberate, and `test_configs.py`
asserts the boundary values the frontend's messages claim.
"""

from datetime import datetime
from uuid import UUID

from pydantic import Field, model_validator

from app.models.enums import ControlMode
from app.schemas.base import CamelModel

# Mirrors CONFIGURABLE_KINDS in frontend/src/types/config.ts. Police and the
# emergency stream are the model's, not the operator's, so they are absent here
# exactly as they are absent from the frontend's mix.
CONFIGURABLE_KINDS: tuple[str, ...] = ("sedan", "hatchback", "taxi", "van", "bus")


class TypeWeights(CamelModel):
    """Unnormalised weights for the arriving stream. Zero removes a kind."""

    sedan: float = Field(ge=0, le=100)
    hatchback: float = Field(ge=0, le=100)
    taxi: float = Field(ge=0, le=100)
    van: float = Field(ge=0, le=100)
    bus: float = Field(ge=0, le=100)

    @model_validator(mode="after")
    def at_least_one_active(self) -> "TypeWeights":
        """A mix where every kind is zero is not a light setting, it is an empty
        junction. The frontend refuses it too, with the same reasoning."""
        if all(weight == 0 for weight in self.model_dump().values()):
            raise ValueError("Mantén al menos un tipo activo.")
        return self


class SimulationConfigCreate(CamelModel):
    quiet_rate_per_minute: float = Field(ge=10, le=120)
    type_weights: TypeWeights
    mode: ControlMode
    # Optional: a saved configuration the operator named, vs. one attached to a
    # run the moment it stops.
    name: str | None = Field(default=None, max_length=120)


class SimulationConfigRead(CamelModel):
    id: UUID
    quiet_rate_per_minute: float
    type_weights: TypeWeights
    mode: ControlMode
    name: str | None
    created_at: datetime
