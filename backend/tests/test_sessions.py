"""`POST /sessions`, `GET /sessions`, `PATCH /sessions/{id}`.

The create payload is `SessionRecord` from `frontend/src/store/sessionsStore.ts`,
which is what the reports screen already builds when a run stops. The shape not
changing across the swap from the local log to the backend is the point.
"""

from datetime import datetime

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


async def test_create_finished_run_persists_both_strategy_frames(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    response = await client.post("/sessions", json=FINISHED_RECORD, headers=auth_headers)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "completed"
    assert body["vehiclesProcessed"] == 412
    assert body["adaptive"]["averageWaitSeconds"] == 12.4
    assert body["fixed"]["averageWaitSeconds"] == 31.9


async def test_a_run_posted_without_an_end_time_is_still_running(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    payload = {**FINISHED_RECORD}
    payload.pop("finishedAt")
    payload.pop("adaptive")
    payload.pop("fixed")

    response = await client.post("/sessions", json=payload, headers=auth_headers)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "running"
    # Not measured yet is `null`, never zero — the two are different claims and
    # the reports screen renders them differently.
    assert body["adaptive"] is None
    assert body["fixed"] is None


async def test_list_returns_the_callers_runs_newest_first(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    older = {**FINISHED_RECORD, "startedAt": "2026-10-15T07:00:00+00:00"}
    newer = {**FINISHED_RECORD, "startedAt": "2026-10-15T09:00:00+00:00"}
    await client.post("/sessions", json=older, headers=auth_headers)
    await client.post("/sessions", json=newer, headers=auth_headers)

    response = await client.get("/sessions", headers=auth_headers)

    assert response.status_code == 200
    started = [run["startedAt"] for run in response.json()]
    assert started == sorted(started, reverse=True)
    assert len(started) == 2


async def test_list_excludes_another_users_runs(
    client: AsyncClient, auth_headers: dict[str, str], other_user_headers: dict[str, str]
) -> None:
    await client.post("/sessions", json=FINISHED_RECORD, headers=auth_headers)

    response = await client.get("/sessions", headers=other_user_headers)

    assert response.status_code == 200
    assert response.json() == []


async def test_patch_marks_a_run_completed_and_supplies_the_end_time(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """A run marked completed without an end time would be a contradiction the
    report query would have to special-case, so the service fills it in."""
    payload = {**FINISHED_RECORD}
    payload.pop("finishedAt")
    payload.pop("durationSeconds")
    created = await client.post("/sessions", json=payload, headers=auth_headers)
    session_id = created.json()["id"]

    response = await client.patch(
        f"/sessions/{session_id}",
        json={"status": "completed", "durationSeconds": 300.0},
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["finishedAt"] is not None
    assert body["durationSeconds"] == 300.0


async def test_patch_does_not_clear_an_untouched_field(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """An omitted field means "leave it alone". If `PATCH` reset everything it
    did not mention, editing one number would un-finish the run."""
    created = await client.post("/sessions", json=FINISHED_RECORD, headers=auth_headers)
    session_id = created.json()["id"]

    response = await client.patch(
        f"/sessions/{session_id}", json={"tickCount": 6100}, headers=auth_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tickCount"] == 6100
    assert body["status"] == "completed"
    # Compared as instants, not strings: the wire format is `Z`, the fixture says
    # `+00:00`, and both are the same moment.
    assert datetime.fromisoformat(body["finishedAt"]) == datetime.fromisoformat(
        FINISHED_RECORD["finishedAt"]
    )


async def test_get_unknown_run_is_not_found(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    response = await client.get(
        "/sessions/00000000-0000-0000-0000-000000000000", headers=auth_headers
    )

    assert response.status_code == 404


async def test_patching_another_users_run_reads_as_absent(
    client: AsyncClient, auth_headers: dict[str, str], other_user_headers: dict[str, str]
) -> None:
    created = await client.post("/sessions", json=FINISHED_RECORD, headers=auth_headers)
    session_id = created.json()["id"]

    response = await client.patch(
        f"/sessions/{session_id}", json={"status": "aborted"}, headers=other_user_headers
    )

    assert response.status_code == 404


async def test_create_session_requires_authentication(client: AsyncClient) -> None:
    response = await client.post("/sessions", json=FINISHED_RECORD)

    assert response.status_code == 401
