"""Authentication routes: login, logout, registration, and password recovery."""

from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from app.core.config import get_settings
from app.core.dependencies import CurrentSession, DbSession
from app.schemas.auth import (
    AuthSessionRead,
    LoginRequest,
    LogoutResponse,
    PasswordResetConfirm,
    PasswordResetConfirmResponse,
    PasswordResetRequest,
    PasswordResetRequestResponse,
    RegisterRequest,
)
from app.schemas.converters import user_to_read
from app.services import auth as auth_service
from app.services.email import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])

# One message for an unknown email and a wrong password. Distinguishing them
# would turn the login route into a way to discover which addresses are
# registered, and it is the same sentence the Phase 1 mock already returned, so
# the screen's copy does not change when this handler takes over.
INVALID_CREDENTIALS = "Correo o contraseña incorrectos"
EMAIL_ALREADY_REGISTERED = "Ya existe una cuenta con este correo."
ROLE_NOT_CONFIGURED = "El registro no está disponible en este momento."
INVALID_RESET_TOKEN = "El enlace no es válido o ha caducado. Solicita uno nuevo."


@router.post("/register", response_model=AuthSessionRead, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: DbSession) -> AuthSessionRead:
    try:
        user = await auth_service.register_user(
            db,
            email=payload.email,
            display_name=payload.display_name,
            password=payload.password,
        )
    except auth_service.EmailAlreadyRegisteredError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=EMAIL_ALREADY_REGISTERED,
        ) from None
    except auth_service.RoleNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ROLE_NOT_CONFIGURED,
        ) from None

    token, session = await auth_service.start_session(db, user=user)

    return AuthSessionRead(
        token=token,
        user=user_to_read(user),
        expires_at=session.expires_at,
    )


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


@router.post(
    "/password-reset/request",
    response_model=PasswordResetRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def request_password_reset(
    payload: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: DbSession,
) -> PasswordResetRequestResponse:
    issued = await auth_service.create_password_reset_token(db, email=payload.email)

    if issued is not None:
        user, token = issued
        base_url = get_settings().frontend_url.rstrip("/")
        reset_url = f"{base_url}/reset-password?token={quote(token, safe='')}"
        # Delivery runs after the response. Waiting on SMTP here would make a
        # registered address measurably slower than an unknown one, which is the
        # enumeration signal the shared message exists to remove.
        background_tasks.add_task(
            send_password_reset_email,
            recipient=user.email,
            display_name=user.display_name,
            reset_url=reset_url,
        )

    return PasswordResetRequestResponse()


@router.post(
    "/password-reset/confirm",
    response_model=PasswordResetConfirmResponse,
)
async def confirm_password_reset(
    payload: PasswordResetConfirm, db: DbSession
) -> PasswordResetConfirmResponse:
    try:
        await auth_service.reset_password(
            db, token=payload.token, password=payload.password
        )
    except auth_service.InvalidPasswordResetTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVALID_RESET_TOKEN,
        ) from None

    return PasswordResetConfirmResponse()
