"""`GET /health`."""

from httpx import AsyncClient


async def test_health_reports_ok_when_the_database_answers(client: AsyncClient) -> None:
    """Against a reachable database the route is honest about both halves: the
    API is up and it can query. `db: "ok"` is the assertion that the `SELECT 1`
    actually ran, not that the process is merely alive."""
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}
