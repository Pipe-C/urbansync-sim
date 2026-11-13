"""Authentication: turning credentials into a session, and ending one."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    hash_password,
    token_expiry,
    verify_password,
)
from app.models.enums import UserRole
from app.models.password_reset_token import PasswordResetToken
from app.models.role import Role
from app.models.session import Session
from app.models.user import User


class EmailAlreadyRegisteredError(Exception):
    """The address already belongs to an account."""


class RoleNotConfiguredError(Exception):
    """The operator role has not been seeded, so registration cannot proceed."""


class InvalidPasswordResetTokenError(Exception):
    """The reset token is unknown, expired, or already used."""


# A real bcrypt hash (rounds 12) of a value no one types. Used as the comparison
# target when the account does not exist, so that path runs the same 12 rounds of
# work as a wrong password. A malformed placeholder — the obvious shortcut — makes
# `checkpw` raise before doing any work, and the response time would then announce
# exactly the difference the response body is hiding.
_DUMMY_HASH = "$2b$12$7M0JoqDvK5/VpIItzWfN1.4Q5azQH6sTiPpmZb2P6CIN5gXV05pR2"


def normalise_email(email: str) -> str:
    """Lower-case and trim. Applied to both the lookup and every insert so two
    accounts can never differ only by the case of their address."""
    return email.strip().lower()


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def register_user(
    db: AsyncSession, *, email: str, display_name: str, password: str
) -> User:
    """Create a new operator account.

    The duplicate check is repeated by the unique index: two simultaneous
    registrations can both pass the `SELECT`, and the loser has to be translated
    into the same 409 rather than a 500.
    """
    normalised = normalise_email(email)

    existing = await db.execute(select(User).where(User.email == normalised))
    if existing.scalar_one_or_none() is not None:
        raise EmailAlreadyRegisteredError

    role = (
        await db.execute(select(Role).where(Role.name == UserRole.OPERATOR))
    ).scalar_one_or_none()
    if role is None:
        raise RoleNotConfiguredError

    user = User(
        email=normalised,
        display_name=display_name.strip(),
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(user)

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise EmailAlreadyRegisteredError from None

    return user


async def authenticate(db: AsyncSession, *, email: str, password: str) -> User | None:
    """Return the user when the credentials match, else `None`.

    The caller must not distinguish "no such user" from "wrong password" in its
    response: either one confirms whether an address is registered, and that is
    the enumeration the frontend's mock already refused to leak.
    """
    result = await db.execute(select(User).where(User.email == normalise_email(email)))
    user = result.scalar_one_or_none()

    if user is None:
        # Still run a verification against a throwaway hash so a missing account
        # and a wrong password cost the same time. Without it, response latency
        # answers the question the response body refuses to.
        verify_password(password, _DUMMY_HASH)
        return None

    if not verify_password(password, user.hashed_password):
        return None

    if not user.is_active:
        return None

    return user


async def start_session(db: AsyncSession, *, user: User) -> tuple[str, Session]:
    """Issue a token and persist the revocation handle it carries."""
    now = datetime.now(UTC)
    expires_at = token_expiry(now)
    token, token_id = create_access_token(
        subject=str(user.id), issued_at=now, expires_at=expires_at
    )

    session = Session(
        user_id=user.id,
        token_id=token_id,
        issued_at=now,
        expires_at=expires_at,
    )
    db.add(session)
    await db.commit()

    return token, session


async def revoke_session(db: AsyncSession, session: Session) -> None:
    """Mark one session ended. Idempotent: revoking twice is not an error."""
    if session.revoked_at is None:
        session.revoked_at = datetime.now(UTC)
        await db.commit()


async def revoke_all_sessions(
    db: AsyncSession, *, user_id: UUID, commit: bool = True
) -> None:
    """Revoke every live session for a user, e.g. after a password reset."""
    await db.execute(
        update(Session)
        .where(Session.user_id == user_id, Session.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    if commit:
        await db.commit()


async def create_password_reset_token(
    db: AsyncSession, *, email: str
) -> tuple[User, str] | None:
    """Issue a reset token for an active account.

    `None` is returned for an unknown or inactive address. The route still
    answers with the same acknowledgement, so the endpoint cannot be used to
    discover which addresses have accounts.

    Any previous unused token for the account is invalidated first: two live
    reset links for the same account is one more than the flow needs.
    """
    result = await db.execute(select(User).where(User.email == normalise_email(email)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        return None

    now = datetime.now(UTC)
    await db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )

    token = secrets.token_urlsafe(32)
    expires_at = now + timedelta(minutes=get_settings().password_reset_expire_minutes)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_reset_token(token),
            expires_at=expires_at,
        )
    )
    await db.commit()

    return user, token


async def reset_password(db: AsyncSession, *, token: str, password: str) -> None:
    """Consume a reset token, replace the password, and revoke every session.

    The token is looked up by digest, so a stolen database row cannot be turned
    back into a working link. A successful reset ends all existing sessions:
    whoever else was signed in loses access at the same moment the password
    changes.
    """
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == _hash_reset_token(token)
        )
    )
    reset = result.scalar_one_or_none()
    now = datetime.now(UTC)

    if reset is None or reset.used_at is not None or reset.expires_at <= now:
        raise InvalidPasswordResetTokenError

    user = reset.user
    if user is None or not user.is_active:
        raise InvalidPasswordResetTokenError

    user.hashed_password = hash_password(password)
    reset.used_at = now
    await revoke_all_sessions(db, user_id=user.id, commit=False)
    await db.commit()
