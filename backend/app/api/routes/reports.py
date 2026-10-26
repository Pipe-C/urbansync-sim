"""The report as data, as CSV and as PDF.

One request per representation, all three reading the same query (`_load`): a
download that could disagree with the screen it was launched from is worse than
no download.

The exports are `Content-Disposition: attachment` with an ASCII filename, so the
browser saves the file instead of rendering it and the name survives every
client. `Cache-Control: no-store` because a run's evidence is the caller's, not
something an intermediary should keep.
"""

from fastapi import APIRouter, Response

from app.api.routes.deps import OwnedSession
from app.core.dependencies import DbSession
from app.models.simulation_session import SimulationSession
from app.schemas.converters import report_to_read
from app.schemas.report import SimulationReportRead
from app.services import exports
from app.services import sessions as sessions_service

router = APIRouter(prefix="/reports", tags=["reports"])


async def _load(db: DbSession, session: SimulationSession) -> SimulationReportRead:
    report = await sessions_service.report_for(db, session_id=session.id)
    samples = await sessions_service.metrics_for(db, session_id=session.id)
    return report_to_read(session, report, samples)


def _attachment(report: SimulationReportRead, extension: str) -> dict[str, str]:
    return {
        "Content-Disposition": (
            f'attachment; filename="{exports.export_filename(report.session, extension)}"'
        ),
        "Cache-Control": "no-store",
    }


@router.get("/{session_id}", response_model=SimulationReportRead)
async def get_report(session: OwnedSession, db: DbSession) -> SimulationReportRead:
    return await _load(db, session)


@router.get("/{session_id}/export.csv")
async def export_csv(session: OwnedSession, db: DbSession) -> Response:
    report = await _load(db, session)
    return Response(
        # The BOM is what makes Excel on Windows read the file as UTF-8; see
        # `services/exports.py`.
        content="\ufeff" + exports.report_to_csv(report),
        media_type="text/csv; charset=utf-8",
        headers=_attachment(report, "csv"),
    )


@router.get("/{session_id}/export.pdf")
async def export_pdf(session: OwnedSession, db: DbSession) -> Response:
    report = await _load(db, session)
    return Response(
        content=exports.report_to_pdf(report),
        media_type="application/pdf",
        headers=_attachment(report, "pdf"),
    )
