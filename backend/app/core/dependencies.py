"""Request dependencies: the authenticated identity behind a request.

`get_current_user` is the gate every protected route depends on. It resolves the
bearer token to a live `Session` row (not just a valid signature), so a logout
takes effect immediately — a bare JWT would keep working until it expired, which
makes "log out" a client-side act with no server meaning.
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import JWTError, decode_access_token
from app.db.session import get_db
from app.models.session import Session
from app.models.user import User

# `auto_error=False` so a missing header produces our own 401 with a
# `WWW-Authenticate` header, identical to an invalid token's.
bearer_scheme = HTTPBearer(auto_error=False)

_UNAUTHENTICATED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Se requiere autenticación.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_session(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Session:
    """The `Session` row a valid, unrevoked token points at."""
    if credentials is None:
        raise _UNAUTHENTICATED

    try:
        payload = decode_access_token(credentials.credentials)
    except JWTError:
        # Signature invalid, malformed, or expired — one response for all three,
        # so the error cannot be used to probe which it was.
        raise _UNAUTHENTICATED from None

    token_id = payload.get("jti")
    if not token_id:
        raise _UNAUTHENTICATED

    result = await db.execute(select(Session).where(Session.token_id == token_id))
    session = result.scalar_one_or_none()

    if session is None or session.revoked_at is not None:
        raise _UNAUTHENTICATED

    if session.expires_at <= datetime.now(UTC):
        raise _UNAUTHENTICATED

    return session


async def get_current_user(
    session: Annotated[Session, Depends(get_current_session)],
) -> User:
    """The user behind the request. `session.user` is eagerly joined."""
    user = session.user
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta está desactivada.",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentSession = Annotated[Session, Depends(get_current_session)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
