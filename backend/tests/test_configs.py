"""`POST /configs` and `GET /configs/{id}`.

The bounds asserted here are the ones `frontend/src/store/configStore.ts` enforces
with Zod. The server restates them because the client is not a security boundary,
and these tests are what keep the two definitions from drifting apart.
"""

from httpx import AsyncClient

VALID_CONFIG = {
    "quietRatePerMinute": 55,
    "typeWeights": {"sedan": 30, "hatchback": 22, "taxi": 13, "van": 15, "bus": 6},
    "mode": "adaptive",
    "name": "Hora pico mañana",
}


async def test_create_config_echoes_the_camel_case_contract(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    response = await client.post("/configs", json=VALID_CONFIG, headers=auth_headers)

    assert response.status_code == 201
    body = response.json()
    assert body["quietRatePerMinute"] == 55
    assert body["typeWeights"] == VALID_CONFIG["typeWeights"]
    assert body["mode"] == "adaptive"
    assert body["name"] == "Hora pico mañana"
    assert body["id"]


async def test_config_defaults_are_accepted(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """`CONFIG_DEFAULTS` from the frontend, verbatim — the values the settings
    screen ships with must not be rejected by the server that stores them."""
    response = await client.post(
        "/configs",
        json={
            "quietRatePerMinute": 55,
            "typeWeights": {"sedan": 30, "hatchback": 22, "taxi": 13, "van": 15, "bus": 6},
            "mode": "adaptive",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json()["name"] is None


async def test_quiet_rate_at_the_lower_bound_is_accepted(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    payload = {**VALID_CONFIG, "quietRatePerMinute": 10}

    response = await client.post("/configs", json=payload, headers=auth_headers)

    assert response.status_code == 201


async def test_quiet_rate_below_the_lower_bound_is_rejected(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    payload = {**VALID_CONFIG, "quietRatePerMinute": 9}

    response = await client.post("/configs", json=payload, headers=auth_headers)

    assert response.status_code == 422


async def test_quiet_rate_above_the_upper_bound_is_rejected(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    payload = {**VALID_CONFIG, "quietRatePerMinute": 121}

    response = await client.post("/configs", json=payload, headers=auth_headers)

    assert response.status_code == 422


async def test_a_weight_above_the_upper_bound_is_rejected(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    payload = {
        **VALID_CONFIG,
        "typeWeights": {"sedan": 101, "hatchback": 0, "taxi": 0, "van": 0, "bus": 0},
    }

    response = await client.post("/configs", json=payload, headers=auth_headers)

    assert response.status_code == 422


async def test_an_all_zero_mix_is_rejected_with_the_frontend_message(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Every kind at zero is an empty junction, not a light setting. The message
    is the same sentence the config screen shows."""
    payload = {
        **VALID_CONFIG,
        "typeWeights": {"sedan": 0, "hatchback": 0, "taxi": 0, "van": 0, "bus": 0},
    }

    response = await client.post("/configs", json=payload, headers=auth_headers)

    assert response.status_code == 422
    assert "al menos un tipo activo" in response.text


async def test_create_config_requires_authentication(client: AsyncClient) -> None:
    response = await client.post("/configs", json=VALID_CONFIG)

    assert response.status_code == 401


async def test_get_config_returns_a_saved_configuration(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    created = await client.post("/configs", json=VALID_CONFIG, headers=auth_headers)
    config_id = created.json()["id"]

    response = await client.get(f"/configs/{config_id}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["id"] == config_id


async def test_get_unknown_config_is_not_found(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    response = await client.get(
        "/configs/00000000-0000-0000-0000-000000000000", headers=auth_headers
    )

    assert response.status_code == 404


async def test_another_users_config_reads_as_absent(
    client: AsyncClient, auth_headers: dict[str, str], other_user_headers: dict[str, str]
) -> None:
    """A config that exists but belongs to someone else returns the same 404 as
    one that does not exist, so the id cannot be probed."""
    created = await client.post("/configs", json=VALID_CONFIG, headers=auth_headers)
    config_id = created.json()["id"]

    response = await client.get(f"/configs/{config_id}", headers=other_user_headers)

    assert response.status_code == 404
