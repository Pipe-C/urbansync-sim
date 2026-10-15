"""`POST /auth/login` and `POST /auth/logout`."""

from datetime import datetime

from httpx import AsyncClient

from app.db.seed import DEMO_EMAIL, DEMO_PASSWORD


async def test_login_returns_the_session_the_frontend_stores(
    client: AsyncClient, demo_user: object
) -> None:
    """The response is `AuthSession` from frontend/src/types/auth.ts, camelCase
    and all — the shell does not change when the mock is swapped for this."""
    response = await client.post(
        "/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    )

    assert response.status_code == 200
    body = response.json()

    assert isinstance(body["token"], str) and body["token"]
    assert body["user"] == {
        "id": body["user"]["id"],
        "email": DEMO_EMAIL,
        "displayName": "Ada Lovelace",
        "role": "operator",
    }


async def test_login_expiry_is_timezone_aware(client: AsyncClient, demo_user: object) -> None:
    """`expiresAt` must carry an offset. The frontend drops an expired session on
    rehydrate with `Date.parse`, and a naive timestamp is parsed in the browser's
    local zone — which would expire the session at the wrong instant, in the
    direction that depends on where the user is sitting."""
    response = await client.post(
        "/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    )

    expires_at = datetime.fromisoformat(response.json()["expiresAt"])
    assert expires_at.tzinfo is not None


async def test_login_is_case_insensitive_in_the_email(
    client: AsyncClient, demo_user: object
) -> None:
    """An address typed with a capital first letter is the same account, not a
    failed login."""
    response = await client.post(
        "/auth/login", json={"email": DEMO_EMAIL.upper(), "password": DEMO_PASSWORD}
    )

    assert response.status_code == 200


async def test_wrong_password_and_unknown_email_are_indistinguishable(
    client: AsyncClient, demo_user: object
) -> None:
    """Both failure modes return one message and one status. Anything that tells
    them apart turns login into a way to test which addresses are registered."""
    wrong_password = await client.post(
        "/auth/login", json={"email": DEMO_EMAIL, "password": "not-the-password"}
    )
    unknown_email = await client.post(
        "/auth/login", json={"email": "nobody@urbansync.sim", "password": DEMO_PASSWORD}
    )

    assert wrong_password.status_code == 401
    assert unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
    assert wrong_password.json()["detail"] == "Correo o contraseña incorrectos"


async def test_login_requires_an_email(client: AsyncClient) -> None:
    response = await client.post("/auth/login", json={"email": "not-an-email", "password": "x"})

    assert response.status_code == 422


async def test_protected_route_without_a_token_is_unauthorized(client: AsyncClient) -> None:
    response = await client.get("/sessions")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


async def test_protected_route_with_a_garbage_token_is_unauthorized(client: AsyncClient) -> None:
    response = await client.get("/sessions", headers={"Authorization": "Bearer not.a.jwt"})

    assert response.status_code == 401


async def test_logout_revokes_the_token_immediately(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """The point of the `sessions` table: after logout the token stops working
    now, not when it would have expired. A bare JWT cannot promise this."""
    assert (await client.get("/sessions", headers=auth_headers)).status_code == 200

    logout = await client.post("/auth/logout", headers=auth_headers)
    assert logout.status_code == 200
    assert logout.json() == {"detail": "Sesión cerrada."}

    after = await client.get("/sessions", headers=auth_headers)
    assert after.status_code == 401


async def test_logout_requires_a_token(client: AsyncClient) -> None:
    response = await client.post("/auth/logout")

    assert response.status_code == 401
