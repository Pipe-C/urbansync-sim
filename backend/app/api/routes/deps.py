"""Route dependencies shared by the run resources.

`/sessions` and `/reports` address the same row from two angles, so the ownership
rule has to be one implementation. Duplicating it is how one of them ends up
returning 403 for a foreign id while the other returns 404, and that difference
is exactly the oracle a probe is looking for: 403 confirms the id is real.

A run that exists but belongs to someone else is reported as absent.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status

from app.core.dependencies import CurrentUser, DbSession
from app.models.simulation_session import SimulationSession
from app.services import sessions as sessions_service

# One instance is enough: an `HTTPException` carries no request state, and
# FastAPI reads it as a value.
NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada."
)


async def get_owned_session(
    session_id: UUID, db: DbSession, user: CurrentUser
) -> SimulationSession:
    """The run addressed by `session_id`, if the caller owns it.

    Declaring `session_id` here instead of in each handler is what lets FastAPI
    read the path parameter once and hand the resolved row to both routers.
    """
    session = await sessions_service.get(db, session_id=session_id)
    if session is None or session.user_id != user.id:
        raise NOT_FOUND
    return session


OwnedSession = Annotated[SimulationSession, Depends(get_owned_session)]

__all__ = ["NOT_FOUND", "OwnedSession", "get_owned_session"]
