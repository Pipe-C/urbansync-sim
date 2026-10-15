"""Session — one issued login, so a JWT can be revoked.

A stateless JWT cannot be withdrawn before it expires, which would make
`POST /auth/logout` a lie: the token would keep working. This table is the small
amount of state that makes logout real — the token carries a `jti` claim, and
`get_current_user` refuses a token whose `jti` has been revoked.

It is deliberately not a refresh-token store (there is no refresh flow in this
project); it is a revocation list with extra columns.
"""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UTCDateTime
from app.models.user import User


class Session(Base, TimestampMixin):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    user: Mapped[User] = relationship(lazy="joined")

    # The JWT's `jti`. Unique and indexed: it is the lookup key on every
    # authenticated request, so it must be as cheap as a primary key.
    token_id: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)

    issued_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Session {self.token_id} user={self.user_id}>"
