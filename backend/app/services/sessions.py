"""Simulation-run persistence.

A created run and its report are written together: the client sends the record
it built when the run stopped, and the report is the comparison that record
carries. Splitting them across two requests would leave a window in which a run
exists with no results, which is the state the reports screen would have to
handle for no reason.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SimulationStatus
from app.models.simulation_report import SimulationReport
from app.models.simulation_session import SimulationSession
from app.schemas.session import SimulationSessionCreate, SimulationSessionUpdate


async def create(
    db: AsyncSession, *, payload: SimulationSessionCreate, user_id: UUID | None
) -> SimulationSession:
    session = SimulationSession(
        user_id=user_id,
        config_id=payload.config_id,
        mode=payload.mode,
        # A run posted with an end time is finished; one posted without is still
        # going and is patched when it stops.
        status=(
            SimulationStatus.COMPLETED if payload.finished_at else SimulationStatus.RUNNING
        ),
        started_at=payload.started_at,
        finished_at=payload.finished_at,
        duration_seconds=payload.duration_seconds,
        tick_count=payload.tick_count,
        vehicles_processed=payload.vehicles_processed,
    )
    db.add(session)

    if payload.has_report():
        assert payload.adaptive is not None and payload.fixed is not None
        db.add(
            SimulationReport(
                session=session,
                adaptive_average_wait_seconds=payload.adaptive.average_wait_seconds,
                adaptive_throughput_per_minute=payload.adaptive.throughput_per_minute,
                adaptive_emergency_response_seconds=(
                    payload.adaptive.emergency_response_seconds
                ),
                adaptive_longest_queue=payload.adaptive.longest_queue,
                fixed_average_wait_seconds=payload.fixed.average_wait_seconds,
                fixed_throughput_per_minute=payload.fixed.throughput_per_minute,
                fixed_emergency_response_seconds=payload.fixed.emergency_response_seconds,
                fixed_longest_queue=payload.fixed.longest_queue,
                vehicles_processed=payload.vehicles_processed,
            )
        )

    await db.commit()
    await db.refresh(session)
    return session


async def list_for_user(db: AsyncSession, *, user_id: UUID) -> list[SimulationSession]:
    """Newest first — the order the reports table shows and the order a person
    looks for their most recent run in."""
    result = await db.execute(
        select(SimulationSession)
        .where(SimulationSession.user_id == user_id)
        .order_by(SimulationSession.started_at.desc())
    )
    return list(result.scalars().all())


async def get(db: AsyncSession, *, session_id: UUID) -> SimulationSession | None:
    result = await db.execute(
        select(SimulationSession).where(SimulationSession.id == session_id)
    )
    return result.scalar_one_or_none()


async def update(
    db: AsyncSession, *, session: SimulationSession, payload: SimulationSessionUpdate
) -> SimulationSession:
    """Apply only the fields the caller actually sent.

    `exclude_unset` is what makes an omitted field mean "leave it alone" rather
    than "set it to None" — a PATCH that cleared `finished_at` every time would
    un-finish a run on any unrelated edit.
    """
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(session, field, value)

    # Keep the two in step: a run marked completed without an end time, or given
    # an end time but left running, is a contradiction the report query would
    # have to special-case.
    if payload.status is SimulationStatus.COMPLETED and session.finished_at is None:
        from datetime import UTC, datetime

        session.finished_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(session)
    return session


async def report_for(db: AsyncSession, *, session_id: UUID) -> SimulationReport | None:
    result = await db.execute(
        select(SimulationReport).where(SimulationReport.session_id == session_id)
    )
    return result.scalar_one_or_none()


async def reports_for(
    db: AsyncSession, *, session_ids: list[UUID]
) -> dict[UUID, SimulationReport]:
    """Reports for a batch of runs in one query.

    `list_sessions` renders a table of runs; fetching each run's report inside a
    loop would be exactly the N+1 this project's own commit guide names.
    """
    if not session_ids:
        return {}

    result = await db.execute(
        select(SimulationReport).where(SimulationReport.session_id.in_(session_ids))
    )
    return {report.session_id: report for report in result.scalars().all()}
