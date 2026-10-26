"""`GET /reports/{session_id}` — the consolidated report.

One request returns everything a screen or an exporter needs about a run: the
run's own record (with both strategy frames), the report's stamp and the metric
samples. A second endpoint for the samples would let the two answers disagree
about which windows they cover, and the export would then be able to print a
summary its own evidence contradicts.
"""

from fastapi import APIRouter

from app.api.routes.deps import OwnedSession
from app.core.dependencies import DbSession
from app.schemas.converters import report_to_read
from app.schemas.report import SimulationReportRead
from app.services import sessions as sessions_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{session_id}", response_model=SimulationReportRead)
async def get_report(session: OwnedSession, db: DbSession) -> SimulationReportRead:
    report = await sessions_service.report_for(db, session_id=session.id)
    samples = await sessions_service.metrics_for(db, session_id=session.id)
    return report_to_read(session, report, samples)
