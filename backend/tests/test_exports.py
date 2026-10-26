"""The CSV and PDF exports.

The rendering rules are tested directly where they are rules (the verdict has to
stay honest even when it is not flattering) and through the endpoint where they
are a contract (media type, attachment name, the evidence the file carries).
"""

from datetime import UTC, datetime
from uuid import UUID
import csv
from io import StringIO

from httpx import AsyncClient

from app.services import exports
from app.schemas.report import SimulationMetricRead, SimulationReportRead
from app.schemas.session import SimulationSessionRead, StrategyFrame

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


def _sample(tick: int, strategy: str) -> dict[str, object]:
    return {
        "tick": tick,
        "t": tick * 0.1,
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


async def test_the_csv_is_one_row_per_strategy_per_window(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    session_id = await _created_run(client, auth_headers)
    await client.post(
        f"/sessions/{session_id}/metrics",
        json={"samples": [_sample(0, "fixed"), _sample(0, "adaptive")]},
        headers=auth_headers,
    )

    response = await client.get(
        f"/reports/{session_id}/export.csv", headers=auth_headers
    )

    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    # The BOM is part of the contract: it is what makes Excel read it as UTF-8.
    assert response.content.startswith(b"\xef\xbb\xbf")

    rows = list(csv.reader(StringIO(response.content.decode("utf-8-sig"))))
    assert rows[0] == list(exports.CSV_COLUMNS)
    assert [row[2] for row in rows[1:]] == ["adaptive", "fixed"]
    assert rows[1][3] == "12.400"
    # A dot decimal, never a comma: a comma would split the field.
    assert rows[2][3] == "31.900"


async def test_the_csv_is_an_attachment_named_after_the_run(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    session_id = await _created_run(client, auth_headers)

    response = await client.get(
        f"/reports/{session_id}/export.csv", headers=auth_headers
    )

    disposition = response.headers["content-disposition"]
    assert disposition.startswith("attachment;")
    assert f'urbansync-20261015-0800-{session_id[:8]}.csv' in disposition
    assert response.headers["cache-control"] == "no-store"


async def test_the_pdf_is_a_pdf_named_after_the_run(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    session_id = await _created_run(client, auth_headers)
    await client.post(
        f"/sessions/{session_id}/metrics",
        json={"samples": [_sample(0, "adaptive"), _sample(0, "fixed")]},
        headers=auth_headers,
    )

    response = await client.get(
        f"/reports/{session_id}/export.pdf", headers=auth_headers
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    assert len(response.content) > 2_000
    assert f'urbansync-20261015-0800-{session_id[:8]}.pdf' in response.headers[
        "content-disposition"
    ]


async def test_a_run_without_samples_still_exports(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """A finished run with no flushed windows is a run whose summary survived
    and whose series did not. Both files still render; the PDF says so."""
    session_id = await _created_run(client, auth_headers)

    csv_response = await client.get(
        f"/reports/{session_id}/export.csv", headers=auth_headers
    )
    pdf_response = await client.get(
        f"/reports/{session_id}/export.pdf", headers=auth_headers
    )

    rows = csv_response.content.decode("utf-8-sig").splitlines()
    assert len(rows) == 1  # header only, no invented readings
    assert pdf_response.status_code == 200
    assert pdf_response.content.startswith(b"%PDF")


async def test_exporting_another_users_run_is_absent(
    client: AsyncClient, auth_headers: dict[str, str], other_user_headers: dict[str, str]
) -> None:
    session_id = await _created_run(client, auth_headers)

    response = await client.get(
        f"/reports/{session_id}/export.pdf", headers=other_user_headers
    )

    assert response.status_code == 404


def test_the_verdict_claims_only_what_the_numbers_support() -> None:
    # The headline case: adaptive is lower, and the sentence says by how much.
    win = exports.verdict_line(12.4, 31.9)
    assert "reduce" in win and "19.5" in win and "61.1" in win

    # The honest loss. A report that hid this would be arguing, not reporting.
    loss = exports.verdict_line(31.9, 12.4)
    assert "ciclo fijo espera menos" in loss

    # A tie is a tie, and no percentage is printed for one.
    assert "igual" in exports.verdict_line(20.0, 20.0)

    # A zero baseline has no ratio to quote.
    assert "referencia" in exports.verdict_line(12.0, 0.0)


def _report(samples: list[SimulationMetricRead]) -> SimulationReportRead:
    """The smallest report a renderer can be handed, built without a database."""
    frame = StrategyFrame.model_validate(FRAME)
    session = SimulationSessionRead(
        id=UUID("3f2a9c1b-0000-0000-0000-000000000000"),
        mode="adaptive",
        status="completed",
        started_at=datetime(2026, 10, 15, 8, 0, tzinfo=UTC),
        finished_at=datetime(2026, 10, 15, 8, 10, tzinfo=UTC),
        duration_seconds=600.0,
        tick_count=6000,
        vehicles_processed=412,
        config_id=None,
        adaptive=frame,
        fixed=frame,
        created_at=datetime(2026, 10, 15, 8, 10, tzinfo=UTC),
    )
    return SimulationReportRead(
        session=session,
        generated_at=datetime(2026, 10, 15, 8, 10, tzinfo=UTC),
        samples=samples,
    )


def test_the_pdf_samples_windows_rather_than_half_the_rows() -> None:
    """The evidence page has to keep each window's two policies on one line.
    Sampling the flat table would take every other row and print a table where
    adaptive and fixed never meet — the comparison missing from its own proof."""
    many = [
        SimulationMetricRead.model_validate(
            {**_sample(tick, strategy), "t": float(tick)}
        )
        for tick in range(200)
        for strategy in ("fixed", "adaptive")  # out of order on purpose
    ]

    grouped = exports.windows(many)
    shown = exports._downsample(grouped, exports.PDF_SAMPLE_ROWS)

    assert len(grouped) == 200
    assert set(grouped[0]) == {"adaptive", "fixed"}
    assert len(shown) == exports.PDF_SAMPLE_ROWS
    assert shown[0] is grouped[0]
    assert shown[-1] is grouped[-1]

    ticks = [next(iter(window.values())).tick for window in shown]
    assert ticks == sorted(ticks)
    assert len(set(ticks)) == len(ticks)


def test_the_pdf_renders_a_report_whose_samples_are_empty() -> None:
    rendered = exports.report_to_pdf(_report([]))

    assert rendered.startswith(b"%PDF")
    assert len(rendered) > 1_000
