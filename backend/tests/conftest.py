"""Shared fixtures.

The tests run against SQLite, not Postgres, because the suite has to run where
the app runs and CI has no database container. That is only an honest choice
because the schema is written to be portable — `Uuid`, `UTCDateTime`,
`Enum(native_enum=False)` and a JSONB variant that falls back to JSON — and
because `alembic check` verifies that the migration produces the same schema the
models describe. The one thing SQLite cannot prove is the exact Postgres DDL; see
the migration's own note.

Every test gets its own in-memory database, so a test that revokes a session or
creates a run cannot be affected by the one before it. `StaticPool` keeps that
database on a single connection, which is what lets an in-memory SQLite survive
across the several connections a request makes.

`TEST_DATABASE_URL` overrides the target, so the identical suite can be run
against PostgreSQL (`TEST_DATABASE_URL=postgresql+asyncpg://… pytest`) — the
dialect the deployment actually uses. Because the fixtures drop every table, a
server target is rejected unless its database name contains `test`; aim it at a
disposable database like `urbansync_test`, never the application one.
"""

from collections.abc import AsyncIterator
import os

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  — registers every table on Base.metadata
from app.db.base import Base
from app.db.seed import DEMO_EMAIL, DEMO_PASSWORD, ensure_demo_user, ensure_roles
from app.db.session import get_db
from app.main import create_app
from app.models.enums import UserRole
from app.models.user import User

# SQLite by default so the suite runs anywhere. Point `TEST_DATABASE_URL` at a
# Postgres URL to run the very same tests against the production dialect — the
# reason the suite is portable in the first place (see the module docstring).
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite+aiosqlite://")


def _assert_safe_target(url: str) -> None:
    """Refuse to run against anything that is not obviously disposable.

    The fixture drops every table it knows about (see `engine` below), so aiming
    `TEST_DATABASE_URL` at the development or production database would erase its
    rows. SQLite here is always in-memory; a server target has to name a database
    that says `test`, which is cheap insurance against a very expensive typo.
    """
    if url.startswith("sqlite"):
        return
    database = url.rsplit("/", 1)[-1].split("?", 1)[0]
    if "test" not in database:
        raise RuntimeError(
            f"Refusing to run against {database!r}: the fixtures drop every table. "
            "Point TEST_DATABASE_URL at a disposable database — its name must "
            "contain 'test', e.g. "
            "postgresql+asyncpg://user:pass@localhost:5432/urbansync_test."
        )


_assert_safe_target(TEST_DATABASE_URL)


def _engine_options(url: str) -> dict[str, object]:
    """In-memory SQLite needs one shared connection to survive a request; a real
    server must not be given SQLite-only connect arguments."""
    if url.startswith("sqlite"):
        return {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}}
    return {}


@pytest_asyncio.fixture
async def engine() -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(TEST_DATABASE_URL, **_engine_options(TEST_DATABASE_URL))
    # `drop_all` first so a run against a persistent server (Postgres) starts from
    # the same empty schema every time, exactly as the in-memory database does.
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def client(session_factory: async_sessionmaker[AsyncSession]) -> AsyncIterator[AsyncClient]:
    """An HTTP client over the real ASGI app, with only the database swapped.

    Everything else — routing, the auth dependency, validation, serialisation —
    is the production code path. Only `get_db` is overridden, because the app's
    engine points at Postgres and the test's points at an in-memory SQLite.
    """
    application = create_app()

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    application.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client


@pytest_asyncio.fixture
async def demo_user(session_factory: async_sessionmaker[AsyncSession]) -> User:
    async with session_factory() as db:
        roles = await ensure_roles(db)
        return await ensure_demo_user(db, roles)


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, demo_user: User) -> dict[str, str]:
    """Logs the demo operator in and returns a ready Authorization header."""
    response = await client.post(
        "/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


@pytest_asyncio.fixture
async def other_user_headers(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession], demo_user: User
) -> dict[str, str]:
    """A second, distinct operator — for the ownership tests.

    Reuses the roles the demo seed created rather than seeding again, so the two
    accounts differ only in identity.
    """
    from app.core.security import hash_password
    from app.models.role import Role
    from sqlalchemy import select

    async with session_factory() as db:
        role = (
            await db.execute(select(Role).where(Role.name == UserRole.EVALUATOR))
        ).scalar_one()
        db.add(
            User(
                email="evaluator@urbansync.sim",
                display_name="Grace Hopper",
                hashed_password=hash_password("evaluator123"),
                role_id=role.id,
                is_active=True,
            )
        )
        await db.commit()

    response = await client.post(
        "/auth/login", json={"email": "evaluator@urbansync.sim", "password": "evaluator123"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}
