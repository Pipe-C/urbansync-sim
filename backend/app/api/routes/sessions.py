"""`POST /sessions`, `GET /sessions`, `PATCH /sessions/{id}`,
`POST /sessions/{id}/metrics`.

The create payload is the record the console builds when a run stops; the metric
batch is the evidence behind it, flushed separately so a long run does not have
to hold its whole history in memory and post it in one request.
"""

from fastapi import APIRouter, status

from app.api.routes.deps import OwnedSession
from app.core.dependencies import CurrentUser, DbSession
from app.schemas.converters import session_to_read
from app.schemas.report import SimulationMetricsCreate, SimulationMetricsSummary
from app.schemas.session import (
    SimulationSessionCreate,
    SimulationSessionRead,
    SimulationSessionUpdate,
)
from app.services import sessions as sessions_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SimulationSessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SimulationSessionCreate, db: DbSession, user: CurrentUser
) -> SimulationSessionRead:
    session = await sessions_service.create(db, payload=payload, user_id=user.id)
    report = await sessions_service.report_for(db, session_id=session.id)
    return session_to_read(session, report)


@router.get("", response_model=list[SimulationSessionRead])
async def list_sessions(db: DbSession, user: CurrentUser) -> list[SimulationSessionRead]:
    sessions = await sessions_service.list_for_user(db, user_id=user.id)
    reports = await sessions_service.reports_for(
        db, session_ids=[session.id for session in sessions]
    )
    return [session_to_read(session, reports.get(session.id)) for session in sessions]


@router.get("/{session_id}", response_model=SimulationSessionRead)
async def get_session(session: OwnedSession, db: DbSession) -> SimulationSessionRead:
    report = await sessions_service.report_for(db, session_id=session.id)
    return session_to_read(session, report)


@router.patch("/{session_id}", response_model=SimulationSessionRead)
async def update_session(
    session: OwnedSession,
    payload: SimulationSessionUpdate,
    db: DbSession,
) -> SimulationSessionRead:
    updated = await sessions_service.update(db, session=session, payload=payload)
    report = await sessions_service.report_for(db, session_id=updated.id)
    return session_to_read(updated, report)


@router.post(
    "/{session_id}/metrics",
    response_model=SimulationMetricsSummary,
    status_code=status.HTTP_201_CREATED,
)
async def add_session_metrics(
    session: OwnedSession, payload: SimulationMetricsCreate, db: DbSession
) -> SimulationMetricsSummary:
    """Append one flush of readings. Safe to retry; see `add_metrics`."""
    return await sessions_service.add_metrics(
        db, session=session, samples=payload.samples
    )
