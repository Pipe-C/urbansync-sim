"""The async engine and the session factory used by request handlers.

One engine per process. `pool_pre_ping` spends a round trip to keep a dead
connection from being handed to a request after Postgres has restarted — the
alternative is a 500 whose cause is invisible from the code that raised it.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    # `echo` is off by default; turn it on per-run with SQLALCHEMY_ECHO if needed.
    pool_pre_ping=True,
)

SessionFactory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    # Handlers read attributes after the transaction that loaded them commits;
    # expiring on commit would turn that read into a lazy load on a closed
    # session, which is an exception rather than a query.
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding a session bound to the request's scope."""
    async with SessionFactory() as session:
        yield session
