"""ORM rows to response schemas.

The mapping lives in one place because it is a contract decision, not a handler
detail: `User.id` is a UUID in storage and a string on the wire, `Role.name` is a
row's column but `User.role` is a value in the payload, and a run's strategy
frames come from a *different* table than the run. Spreading that across three
handlers is how the three drift apart.
"""

from app.models.simulation_config import SimulationConfig
from app.models.simulation_report import SimulationReport
from app.models.simulation_session import SimulationSession
from app.models.user import User
from app.schemas.auth import UserRead
from app.schemas.config import SimulationConfigRead, TypeWeights
from app.schemas.session import SimulationSessionRead, StrategyFrame


def user_to_read(user: User) -> UserRead:
    return UserRead(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        # The role is its own table; the API contract flattens it to the value.
        role=user.role.name,
    )


def config_to_read(config: SimulationConfig) -> SimulationConfigRead:
    return SimulationConfigRead(
        id=config.id,
        quiet_rate_per_minute=config.quiet_rate_per_minute,
        type_weights=TypeWeights.model_validate(config.type_weights),
        mode=config.mode,
        name=config.name,
        created_at=config.created_at,
    )


def _frame_to_read(report: SimulationReport, prefix: str) -> StrategyFrame:
    return StrategyFrame(
        average_wait_seconds=getattr(report, f"{prefix}_average_wait_seconds"),
        throughput_per_minute=getattr(report, f"{prefix}_throughput_per_minute"),
        emergency_response_seconds=getattr(report, f"{prefix}_emergency_response_seconds"),
        longest_queue=getattr(report, f"{prefix}_longest_queue"),
    )


def session_to_read(
    session: SimulationSession, report: SimulationReport | None
) -> SimulationSessionRead:
    """A run without a report reads `null` for both frames: it has not measured
    anything yet, and a zero would say it measured nothing happening."""
    return SimulationSessionRead(
        id=session.id,
        mode=session.mode,
        status=session.status,
        started_at=session.started_at,
        finished_at=session.finished_at,
        duration_seconds=session.duration_seconds,
        tick_count=session.tick_count,
        vehicles_processed=session.vehicles_processed,
        config_id=session.config_id,
        adaptive=_frame_to_read(report, "adaptive") if report else None,
        fixed=_frame_to_read(report, "fixed") if report else None,
        created_at=session.created_at,
    )
