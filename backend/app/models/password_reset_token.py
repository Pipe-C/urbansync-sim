"""PasswordResetToken — a one-use handle for choosing a new password.

Only the SHA-256 digest of the token is stored. A database leak therefore does
not hand the attacker working reset links, exactly as `users.hashed_password`
does not hand them passwords. The raw token exists only in the email and in the
request that consumes it.
"""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UTCDateTime
from app.models.user import User


class PasswordResetToken(Base, TimestampMixin):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    user: Mapped[User] = relationship(lazy="joined")

    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<PasswordResetToken user={self.user_id}>"
