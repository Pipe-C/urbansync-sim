"""Domain vocabularies, defined once at the persistence layer.

These enumerations are shared by the ORM models and the Pydantic schemas: the
frontend's `UserRole` and `ControlMode` are the same two sets of values, and a
second copy in the schemas would be a second place for them to drift.

They are `str` enums so a value survives a JSON round trip unchanged — the API
speaks `"adaptive"`, not `<ControlMode.ADAPTIVE: 1>`.
"""

from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import Enum as SAEnum


class UserRole(StrEnum):
    """Mirrors `UserRole` in `frontend/src/types/auth.ts`."""

    OPERATOR = "operator"
    EVALUATOR = "evaluator"


class ControlMode(StrEnum):
    """Mirrors `ControlMode` in `frontend/src/types/metrics.ts`."""

    ADAPTIVE = "adaptive"
    FIXED = "fixed"


class SimulationStatus(StrEnum):
    """Lifecycle of a stored run. `aborted` is a run stopped early or whose
    process died; it is kept rather than deleted because a run that failed is
    still evidence about the controller."""

    RUNNING = "running"
    COMPLETED = "completed"
    ABORTED = "aborted"


def enum_column(
    enum_cls: type[StrEnum], *, name: str, length: int = 20, **kwargs: Any
) -> SAEnum:
    """A VARCHAR-backed, value-storing enum column.

    Two deliberate choices:

    - `native_enum=False` stores the value in a `VARCHAR` with a `CHECK`
      constraint instead of a PostgreSQL `ENUM` type. A native enum cannot be
      altered inside a transaction without `ALTER TYPE`, which makes adding a
      value a migration of its own; a check constraint is a normal migration.
    - `values_callable` stores `"adaptive"`, not `"ADAPTIVE"`. Without it
      SQLAlchemy stores the member *name*, and the database would disagree with
      the API about the spelling of the same concept.

    `create_constraint=True` is explicit because SQLAlchemy 2.0 defaults it to
    `False`: without it `native_enum=False` produces a bare `VARCHAR` that accepts
    any string, and the CHECK this column is documented to have would not exist.
    The constraint is named after `name`, and the name must be unique within a
    table — two columns in the same table cannot share one enum vocabulary.
    """
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=False,
        length=length,
        create_constraint=True,
        values_callable=lambda members: [m.value for m in members],
        **kwargs,
    )


__all__: Sequence[str] = ["UserRole", "ControlMode", "SimulationStatus", "enum_column"]
