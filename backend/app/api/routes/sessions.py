"""`POST /sessions`, `GET /sessions`, `PATCH /sessions/{id}`."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import CurrentUser, DbSession
from app.models.simulation_session import SimulationSession
from app.schemas.converters import session_to_read
from app.schemas.session import (
    SimulationSessionCreate,
    SimulationSessionRead,
    SimulationSessionUpdate,
)
from app.services import sessions as sessions_service

router = APIRouter(prefix="/sessions", tags=["sessions"])

# A run that exists but belongs to someone else is reported as absent. A 403
# would confirm the id is real, which is the one fact a probe is looking for.
NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")


async def _owned(db: DbSession, session_id: UUID, user_id: UUID) -> SimulationSession:
    session = await sessions_service.get(db, session_id=session_id)
    if session is None or session.user_id != user_id:
        raise NOT_FOUND
    return session


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
async def get_session(
    session_id: UUID, db: DbSession, user: CurrentUser
) -> SimulationSessionRead:
    session = await _owned(db, session_id, user.id)
    report = await sessions_service.report_for(db, session_id=session.id)
    return session_to_read(session, report)


@router.patch("/{session_id}", response_model=SimulationSessionRead)
async def update_session(
    session_id: UUID,
    payload: SimulationSessionUpdate,
    db: DbSession,
    user: CurrentUser,
) -> SimulationSessionRead:
    session = await _owned(db, session_id, user.id)
    updated = await sessions_service.update(db, session=session, payload=payload)
    report = await sessions_service.report_for(db, session_id=updated.id)
    return session_to_read(updated, report)
