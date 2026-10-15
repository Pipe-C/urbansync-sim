"""The realtime layer: the Socket.io server and the fact it shares one process
with the REST API.

These tests exercise the two things that can be checked without a running
engine: that the Socket.io handshake is served, and that wrapping the app did not
shadow the REST routes. What they deliberately do not assert is a tick — there is
no engine yet, and a test that accepted invented numbers would be the opposite of
useful.
"""

from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.ws.server import asgi_app
from app.db.session import get_db
from app.main import create_app


@pytest_asyncio.fixture
async def wrapped_client(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncClient]:
    """A client over the same ASGI callable the process serves: FastAPI wrapped
    by Socket.io."""
    application = create_app()

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    application.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=asgi_app(application))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def test_socket_io_handshake_is_served(wrapped_client: AsyncClient) -> None:
    """The engine.io opening handshake. A client that reaches this gets a session
    id, which is what `socket.io-client` needs before it can connect."""
    response = await wrapped_client.get("/socket.io/?EIO=4&transport=polling")

    assert response.status_code == 200
    assert '"sid"' in response.text


async def test_rest_routes_survive_the_wrapper(wrapped_client: AsyncClient) -> None:
    """Socket.io owns one path; everything else must still land on FastAPI. If the
    wrapper swallowed `/health`, the container's own healthcheck would fail."""
    response = await wrapped_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}
