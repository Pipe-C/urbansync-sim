"""`POST /auth/login` and `POST /auth/logout`."""

from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import CurrentSession, DbSession
from app.schemas.auth import AuthSessionRead, LoginRequest, LogoutResponse
from app.schemas.converters import user_to_read
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

# One message for an unknown email and a wrong password. Distinguishing them
# would turn the login route into a way to discover which addresses are
# registered, and it is the same sentence the Phase 1 mock already returned, so
# the screen's copy does not change when this handler takes over.
INVALID_CREDENTIALS = "Correo o contraseña incorrectos"


@router.post("/login", response_model=AuthSessionRead)
async def login(payload: LoginRequest, db: DbSession) -> AuthSessionRead:
    user = await auth_service.authenticate(
        db, email=payload.email, password=payload.password
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS,
            headers={"WWW-Authenticate": "Bearer"},
        )

    token, session = await auth_service.start_session(db, user=user)

    return AuthSessionRead(
        token=token,
        user=user_to_read(user),
        expires_at=session.expires_at,
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(session: CurrentSession, db: DbSession) -> LogoutResponse:
    """Revokes the session the presented token belongs to. The token stops
    working immediately rather than at its expiry — see `get_current_session`."""
    await auth_service.revoke_session(db, session)
    return LogoutResponse()
