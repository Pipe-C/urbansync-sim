"""ORM models.

Every model is imported here so that one `import app.models` registers the whole
schema on `Base.metadata`. Alembic and `Base.metadata.create_all` both depend on
that: a model that is defined but never imported is invisible to migrations, and
the failure mode — a table that exists in the code and not in the database — is
exactly the kind that reaches production.
"""

from app.models.enums import ControlMode, SimulationStatus, UserRole
from app.models.password_reset_token import PasswordResetToken
from app.models.role import Role
from app.models.session import Session
from app.models.simulation_config import SimulationConfig
from app.models.simulation_metric import SimulationMetric
from app.models.simulation_report import SimulationReport
from app.models.simulation_session import SimulationSession
from app.models.user import User

__all__ = [
    "ControlMode",
    "PasswordResetToken",
    "Role",
    "Session",
    "SimulationConfig",
    "SimulationMetric",
    "SimulationReport",
    "SimulationSession",
    "SimulationStatus",
    "User",
    "UserRole",
]
