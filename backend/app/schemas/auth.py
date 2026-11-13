"""Auth request/response bodies.

The response shapes are the frontend's `AuthSession` and `User` from
`frontend/src/types/auth.ts`, field for field. `expiresAt` is a timezone-aware
ISO timestamp because the frontend drops an expired session on rehydrate with
`Date.parse(session.expiresAt)` — a naive datetime would be parsed in the
browser's local zone and the session would expire at the wrong instant.
"""

from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from app.models.enums import UserRole
from app.schemas.base import CamelModel


class LoginRequest(CamelModel):
    email: EmailStr
    # Upper bound is a guard, not a policy: bcrypt only reads the first 72 bytes.
    # `max_length` counts characters, so the authoritative truncation happens in
    # `app.core.security.hash_password`.
    password: str = Field(min_length=1, max_length=256)


class RegisterRequest(CamelModel):
    display_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)

    @field_validator("display_name", mode="before")
    @classmethod
    def _trim_display_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class PasswordResetRequest(CamelModel):
    email: EmailStr


class PasswordResetConfirm(CamelModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=8, max_length=256)


class UserRead(CamelModel):
    id: str
    email: EmailStr
    display_name: str
    role: UserRole


class AuthSessionRead(CamelModel):
    """Token plus the identity it authenticates, so the client stores one object
    and never has to call a second endpoint to render the shell."""

    token: str
    user: UserRead
    expires_at: datetime


class LogoutResponse(CamelModel):
    """An empty acknowledgement rather than a 204: the frontend's fetch wrapper
    treats a bodyless response inconsistently across browsers, and a one-field
    object removes the ambiguity for no cost."""

    detail: str = "Sesión cerrada."


class PasswordResetRequestResponse(CamelModel):
    detail: str = (
        "Si el correo está registrado, recibirás un enlace para restablecer la contraseña."
    )


class PasswordResetConfirmResponse(CamelModel):
    detail: str = "Contraseña actualizada. Ya puedes iniciar sesión."
