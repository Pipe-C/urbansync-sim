"""Authentication: turning credentials into a session, and ending one."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, token_expiry, verify_password
from app.models.session import Session
from app.models.user import User

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
