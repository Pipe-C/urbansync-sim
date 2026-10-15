"""Seed the data the demo cannot start without.

The frontend's login screen fills `admin@urbansync.sim` / `admin123` on request
(see `DEMO_CREDENTIALS` in `frontend/src/services/auth.ts`). Those credentials
have to exist in the database for that button to work against the real API, and
they cannot be committed as a migration, because a migration is schema and a
password is data.

Idempotent by construction: it looks for each row before writing it, so running
it twice, or on every deploy, changes nothing the second time.

    python -m app.db.seed
"""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.session import SessionFactory
from app.models.enums import UserRole
from app.models.role import Role
from app.models.user import User

# The two roles the product recognises, mirroring `UserRole` in the frontend.
ROLE_DESCRIPTIONS: dict[UserRole, str] = {
    UserRole.OPERATOR: "Opera la simulación y configura el cruce.",
    UserRole.EVALUATOR: "Observa los resultados sin operar.",
}

DEMO_EMAIL = "admin@urbansync.sim"
DEMO_PASSWORD = "admin123"
DEMO_DISPLAY_NAME = "Ada Lovelace"


async def ensure_roles(db: AsyncSession) -> dict[UserRole, Role]:
    """Every role, created if absent. Returns them keyed by value."""
    existing = {role.name: role for role in (await db.execute(select(Role))).scalars()}

    for name, description in ROLE_DESCRIPTIONS.items():
        if name not in existing:
            role = Role(name=name, description=description)
            db.add(role)
            existing[name] = role

    await db.commit()
    return existing


async def ensure_demo_user(db: AsyncSession, roles: dict[UserRole, Role]) -> User:
    """The one operator account. Returns it whether it was created or already
    present."""
    result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
    existing = result.scalar_one_or_none()
    if existing is not None:
        return existing

    user = User(
        email=DEMO_EMAIL,
        display_name=DEMO_DISPLAY_NAME,
        hashed_password=hash_password(DEMO_PASSWORD),
        role_id=roles[UserRole.OPERATOR].id,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def seed() -> None:
    async with SessionFactory() as db:
        roles = await ensure_roles(db)
        user = await ensure_demo_user(db, roles)

    print(f"seed ok — {len(roles)} roles, demo operator {user.email}")


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
