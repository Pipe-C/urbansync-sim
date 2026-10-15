"""Role — the operator capability a user holds.

A table rather than a bare enum because PLAN.md lists it as a model and because
a role is expected to grow a description and, later, permissions. Users hold one
role (the frontend models `role` as a single value), so this is a plain
many-to-one rather than a many-to-many join table: a join table would be
structure with no second column to justify it.
"""

import uuid

from sqlalchemy import String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import UserRole, enum_column


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[UserRole] = mapped_column(
        enum_column(UserRole, name="role_name", length=20),
        unique=True,
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(String(255))

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Role {self.name}>"
