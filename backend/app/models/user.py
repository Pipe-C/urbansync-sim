"""User — an account that can sign in.

The password is stored only as a bcrypt hash (`hashed_password`), never in a
form the application can reverse. The field name says so on purpose: a column
called `password` invites a caller to compare against it directly, and the only
correct comparison runs through `app.core.security.verify_password`.
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.role import Role


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # Stored already lower-cased; the login handler normalises before both the
    # lookup and the insert so two accounts can never differ only by case.
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id"), nullable=False)
    # `joined` because every authenticated request needs the role to answer, and
    # a lazy load under asyncio is an exception rather than a query.
    role: Mapped[Role] = relationship(lazy="joined")

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<User {self.email}>"
