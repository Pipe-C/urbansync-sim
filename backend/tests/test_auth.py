"""Auth routes: login, logout, registration, and password recovery."""

import hashlib
from datetime import UTC, datetime
from unittest.mock import AsyncMock
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.routes import auth as auth_routes
from app.core.security import verify_password
from app.db.seed import DEMO_EMAIL, DEMO_PASSWORD
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.services import auth as auth_service


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


@pytest.mark.parametrize(
    "email",
    [
        "admin@urbansync.sim' OR '1'='1",
        "admin@urbansync.sim'--",
        "' OR 1=1 --",
        'admin@urbansync.sim" OR "1"="1',
    ],
)
async def test_login_rejects_sql_injection_payloads_in_the_email(
    client: AsyncClient, email: str
) -> None:
    """`EmailStr` rejects these before the query, and the query itself binds the
    address as a parameter. The table must never be decoded from this input."""
    response = await client.post(
        "/auth/login", json={"email": email, "password": DEMO_PASSWORD}
    )

    assert response.status_code == 422
    assert "token" not in response.json()


async def test_login_does_not_interpret_sql_in_the_password(
    client: AsyncClient, demo_user: object
) -> None:
    """The password never reaches SQL: it is compared with bcrypt. A payload
    that would close a quoted WHERE clause is just a wrong password."""
    response = await client.post(
        "/auth/login",
        json={"email": DEMO_EMAIL, "password": "admin123' OR '1'='1"},
    )

    assert response.status_code == 401
    assert "token" not in response.json()


async def test_the_auth_service_treats_an_injection_string_as_data(
    demo_user: object, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    """Bypass the request schema and call the service directly: even if an
    unvalidated string reached the repository, SQLAlchemy binds it as a value
    rather than concatenating it into SQL."""
    async with session_factory() as db:
        user = await auth_service.authenticate(
            db, email="' OR 1=1 --", password=DEMO_PASSWORD
        )

    assert user is None


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


async def test_register_creates_an_operator_and_returns_a_session(
    client: AsyncClient,
    demo_user: object,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    response = await client.post(
        "/auth/register",
        json={
            "displayName": "  Grace Hopper  ",
            "email": "GRACE@Example.com",
            "password": "compiler123",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["token"]
    assert body["user"] == {
        "id": body["user"]["id"],
        "email": "grace@example.com",
        "displayName": "Grace Hopper",
        "role": "operator",
    }

    async with session_factory() as db:
        user = (
            await db.execute(select(User).where(User.email == "grace@example.com"))
        ).scalar_one()

    assert user.display_name == "Grace Hopper"
    assert user.hashed_password != "compiler123"
    assert verify_password("compiler123", user.hashed_password)

    protected = await client.get(
        "/sessions", headers={"Authorization": f"Bearer {body['token']}"}
    )
    assert protected.status_code == 200


async def test_register_rejects_a_case_variant_of_an_existing_email(
    client: AsyncClient, demo_user: object
) -> None:
    response = await client.post(
        "/auth/register",
        json={
            "displayName": "Another Ada",
            "email": DEMO_EMAIL.upper(),
            "password": "another123",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Ya existe una cuenta con este correo."


async def test_register_rejects_a_short_password(client: AsyncClient, demo_user: object) -> None:
    response = await client.post(
        "/auth/register",
        json={
            "displayName": "Grace Hopper",
            "email": "grace@example.com",
            "password": "short",
        },
    )

    assert response.status_code == 422


async def test_password_reset_revokes_sessions_and_replaces_the_password(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: object,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    send_email = AsyncMock()
    monkeypatch.setattr(auth_routes, "send_password_reset_email", send_email)

    requested = await client.post(
        "/auth/password-reset/request", json={"email": DEMO_EMAIL}
    )

    assert requested.status_code == 202
    assert requested.json() == {
        "detail": "Si el correo está registrado, recibirás un enlace para restablecer la contraseña."
    }
    send_email.assert_awaited_once()

    reset_url = send_email.await_args.kwargs["reset_url"]
    token = parse_qs(urlparse(reset_url).query)["token"][0]

    async with session_factory() as db:
        stored = (await db.execute(select(PasswordResetToken))).scalar_one()
        assert stored.token_hash == hashlib.sha256(token.encode("utf-8")).hexdigest()
        assert stored.token_hash != token
        assert stored.expires_at > datetime.now(UTC)

    confirmed = await client.post(
        "/auth/password-reset/confirm",
        json={"token": token, "password": "new-password-123"},
    )
    assert confirmed.status_code == 200

    assert (await client.get("/sessions", headers=auth_headers)).status_code == 401
    assert (
        await client.post(
            "/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
        )
    ).status_code == 401
    assert (
        await client.post(
            "/auth/login", json={"email": DEMO_EMAIL, "password": "new-password-123"}
        )
    ).status_code == 200

    reused = await client.post(
        "/auth/password-reset/confirm",
        json={"token": token, "password": "another-password-123"},
    )
    assert reused.status_code == 400


async def test_password_reset_request_does_not_reveal_unknown_email(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    send_email = AsyncMock()
    monkeypatch.setattr(auth_routes, "send_password_reset_email", send_email)

    response = await client.post(
        "/auth/password-reset/request", json={"email": "nobody@urbansync.sim"}
    )

    assert response.status_code == 202
    assert response.json() == {
        "detail": "Si el correo está registrado, recibirás un enlace para restablecer la contraseña."
    }
    send_email.assert_not_awaited()


async def test_password_reset_rejects_an_invalid_token(client: AsyncClient) -> None:
    response = await client.post(
        "/auth/password-reset/confirm",
        json={"token": "x" * 43, "password": "new-password-123"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "El enlace no es válido o ha caducado. Solicita uno nuevo."
    )


async def test_a_new_reset_request_invalidates_the_previous_link(
    client: AsyncClient,
    demo_user: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    send_email = AsyncMock()
    monkeypatch.setattr(auth_routes, "send_password_reset_email", send_email)

    await client.post("/auth/password-reset/request", json={"email": DEMO_EMAIL})
    await client.post("/auth/password-reset/request", json={"email": DEMO_EMAIL})

    first_url = send_email.await_args_list[0].kwargs["reset_url"]
    second_url = send_email.await_args_list[1].kwargs["reset_url"]
    first_token = parse_qs(urlparse(first_url).query)["token"][0]
    second_token = parse_qs(urlparse(second_url).query)["token"][0]

    stale = await client.post(
        "/auth/password-reset/confirm",
        json={"token": first_token, "password": "new-password-123"},
    )
    current = await client.post(
        "/auth/password-reset/confirm",
        json={"token": second_token, "password": "new-password-123"},
    )

    assert stale.status_code == 400
    assert current.status_code == 200
