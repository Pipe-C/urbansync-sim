"""`POST /sessions/{id}/metrics` and `GET /reports/{id}`.

The metric batch is the evidence and the report is the conclusion drawn from it,
so these tests exercise both together: stored order, retry behaviour and the
ownership rule that keeps one operator's evidence out of another's report.
"""

from httpx import AsyncClient

FRAME = {
    "averageWaitSeconds": 12.4,
    "throughputPerMinute": 38.0,
    "emergencyResponseSeconds": 4.2,
    "longestQueue": 7,
}

FINISHED_RECORD = {
    "startedAt": "2026-10-15T08:00:00+00:00",
    "finishedAt": "2026-10-15T08:10:00+00:00",
    "durationSeconds": 600.0,
    "tickCount": 6000,
    "mode": "adaptive",
    "vehiclesProcessed": 412,
    "adaptive": FRAME,
    "fixed": {**FRAME, "averageWaitSeconds": 31.9, "longestQueue": 19},
}


def _sample(tick: int, strategy: str, *, t: float | None = None) -> dict[str, object]:
    return {
        "tick": tick,
        "t": tick * 0.1 if t is None else t,
        "strategy": strategy,
        "averageWaitSeconds": 12.4 if strategy == "adaptive" else 31.9,
        "throughputPerMinute": 38.0 if strategy == "adaptive" else 31.0,
        "emergencyResponseSeconds": 4.2 if strategy == "adaptive" else 9.8,
        "longestQueue": 7 if strategy == "adaptive" else 19,
    }


async def _created_run(client: AsyncClient, headers: dict[str, str]) -> str:
    response = await client.post("/sessions", json=FINISHED_RECORD, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def test_a_batch_is_stored_and_read_back_per_window(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    session_id = await _created_run(client, auth_headers)

    # Deliberately out of order: the endpoint must not depend on the client's
    # flush order, because a retry can arrive after a later batch.
    batch = {"samples": [_sample(20, "fixed"), _sample(0, "fixed"), _sample(0, "adaptive")]}
    created = await client.post(
        f"/sessions/{session_id}/metrics", json=batch, headers=auth_headers
    )

    assert created.status_code == 201
    assert created.json() == {"accepted": 3, "duplicates": 0}

    report = await client.get(f"/reports/{session_id}", headers=auth_headers)
    assert report.status_code == 200
    samples = report.json()["samples"]

    # One window's two policies sit together, adaptive first: the order is a
    # contract of the query, not of the insert.
    assert [(row["tick"], row["strategy"]) for row in samples] == [
        (0, "adaptive"),
        (0, "fixed"),
        (20, "fixed"),
    ]
    assert samples[2]["averageWaitSeconds"] == 31.9


async def test_replaying_a_batch_is_idempotent(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """A dropped response is retried. The retry must not double-count the run's
    evidence — the table's unique constraint says which read is the truth."""
    session_id = await _created_run(client, auth_headers)
    batch = {"samples": [_sample(0, "adaptive"), _sample(0, "fixed")]}

    first = await client.post(
        f"/sessions/{session_id}/metrics", json=batch, headers=auth_headers
    )
    second = await client.post(
        f"/sessions/{session_id}/metrics", json=batch, headers=auth_headers
    )

    assert first.json() == {"accepted": 2, "duplicates": 0}
    # Reported, not swallowed: a client stuck replaying is a bug worth seeing.
    assert second.json() == {"accepted": 0, "duplicates": 2}

    report = await client.get(f"/reports/{session_id}", headers=auth_headers)
    assert len(report.json()["samples"]) == 2


async def test_duplicate_windows_inside_one_batch_are_collapsed(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Sending the same window twice in one flush cannot get one copy through by
    arriving alongside the other."""
    session_id = await _created_run(client, auth_headers)

    response = await client.post(
        f"/sessions/{session_id}/metrics",
        json={"samples": [_sample(5, "adaptive"), _sample(5, "adaptive")]},
        headers=auth_headers,
    )

    assert response.json() == {"accepted": 1, "duplicates": 1}


async def test_the_report_nests_the_run_the_stamp_and_the_samples(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    session_id = await _created_run(client, auth_headers)
    await client.post(
        f"/sessions/{session_id}/metrics",
        json={"samples": [_sample(0, "adaptive"), _sample(0, "fixed")]},
        headers=auth_headers,
    )

    body = (await client.get(f"/reports/{session_id}", headers=auth_headers)).json()

    assert body["session"]["id"] == session_id
    assert body["session"]["vehiclesProcessed"] == 412
    assert body["session"]["adaptive"]["averageWaitSeconds"] == 12.4
    assert body["session"]["fixed"]["averageWaitSeconds"] == 31.9
    assert body["generatedAt"] is not None
    assert len(body["samples"]) == 2


async def test_a_run_still_measuring_reads_a_null_stamp(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """The run exists before it has a report. The report endpoint says so with a
    null stamp rather than inventing a generation time for a conclusion that has
    not been drawn yet."""
    payload = {**FINISHED_RECORD}
    payload.pop("finishedAt")
    payload.pop("adaptive")
    payload.pop("fixed")
    created = await client.post("/sessions", json=payload, headers=auth_headers)
    session_id = created.json()["id"]

    body = (await client.get(f"/reports/{session_id}", headers=auth_headers)).json()

    assert body["session"]["status"] == "running"
    assert body["session"]["adaptive"] is None
    assert body["generatedAt"] is None
    assert body["samples"] == []


async def test_another_users_report_is_absent(
    client: AsyncClient, auth_headers: dict[str, str], other_user_headers: dict[str, str]
) -> None:
    session_id = await _created_run(client, auth_headers)

    response = await client.get(f"/reports/{session_id}", headers=other_user_headers)

    assert response.status_code == 404


async def test_writing_metrics_to_another_users_run_is_absent(
    client: AsyncClient, auth_headers: dict[str, str], other_user_headers: dict[str, str]
) -> None:
    session_id = await _created_run(client, auth_headers)

    response = await client.post(
        f"/sessions/{session_id}/metrics",
        json={"samples": [_sample(0, "adaptive")]},
        headers=other_user_headers,
    )

    assert response.status_code == 404


async def test_an_unknown_report_is_absent(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    response = await client.get(
        "/reports/00000000-0000-0000-0000-000000000000", headers=auth_headers
    )

    assert response.status_code == 404


async def test_a_negative_reading_is_rejected(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """A negative wait is not a measurement, so it fails validation instead of
    landing in the table and skewing an average."""
    session_id = await _created_run(client, auth_headers)
    sample = _sample(0, "adaptive")
    sample["averageWaitSeconds"] = -1.0

    response = await client.post(
        f"/sessions/{session_id}/metrics",
        json={"samples": [sample]},
        headers=auth_headers,
    )

    assert response.status_code == 422


async def test_an_empty_batch_is_rejected(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """An empty flush is a sampler bug, and accepting it would make a broken
    sampler indistinguishable from a quiet run."""
    session_id = await _created_run(client, auth_headers)

    response = await client.post(
        f"/sessions/{session_id}/metrics", json={"samples": []}, headers=auth_headers
    )

    assert response.status_code == 422


async def test_reports_require_authentication(client: AsyncClient) -> None:
    response = await client.get("/reports/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 401
