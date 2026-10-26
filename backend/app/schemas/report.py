"""Run evidence: the metric samples a run accumulated and its consolidated report.

Two different shapes, for two different readers:

- `SimulationMetric*` is the **evidence**. One row per strategy per sample
  window, which is what `simulation_metrics` stores and what an export writes
  out. It is accepted in batches so a client can flush while the run is live
  instead of holding a session's whole history in memory and posting it at the
  end.
- `SimulationReportRead` is the **conclusion**. It nests the run's own read
  (which already carries both strategy frames and the processed count) next to
  the samples, so the reports screen and the exporters read one query rather
  than two endpoints that can disagree about which samples they cover.

The session is nested rather than flattened on purpose: `adaptive`/`fixed`
already live in `SimulationSessionRead`, and copying them here would give the
same numbers two spellings, which is the drift the converters module exists to
prevent.
"""

from datetime import datetime

from pydantic import Field

from app.models.enums import ControlMode
from app.schemas.base import CamelModel
from app.schemas.session import SimulationSessionRead

# A run ticks about ten times a second and reports one window every two
# seconds, so a ten-minute run is ~300 windows / 600 rows. The cap is generous
# enough for an afternoon of a single run and small enough that one request
# cannot be used as a memory amplifier.
MAX_SAMPLES_PER_BATCH = 20_000


class SimulationMetricCreate(CamelModel):
    """One strategy's reading for one sample window.

    Mirrors `StrategyFrame` plus the window's coordinates. `tick` is the run's
    own tick index (the backend's clock) and `t` is elapsed seconds, kept
    together so an export can plot without assuming a tick length.
    """

    tick: int = Field(ge=0)
    t: float = Field(ge=0)
    strategy: ControlMode

    average_wait_seconds: float = Field(ge=0)
    throughput_per_minute: float = Field(ge=0)
    emergency_response_seconds: float = Field(ge=0)
    longest_queue: int = Field(ge=0)


class SimulationMetricRead(SimulationMetricCreate):
    """The same reading as stored. Distinct from the create body so a future
    stored-only field (a server id, a received-at stamp) cannot appear in the
    request contract by accident."""


class SimulationMetricsCreate(CamelModel):
    """A batch of readings for one run.

    At least one sample: an empty flush is a client bug, and accepting it would
    make a broken sampler look like a quiet run.
    """

    samples: list[SimulationMetricCreate] = Field(
        min_length=1, max_length=MAX_SAMPLES_PER_BATCH
    )


class SimulationMetricsSummary(CamelModel):
    """What the write actually did.

    `duplicates` is reported rather than swallowed: a retry after a dropped
    response is normal, so the endpoint is idempotent, but a client that keeps
    replaying the same window is a bug worth seeing in the response.
    """

    accepted: int
    duplicates: int


class SimulationReportRead(CamelModel):
    """One run, its comparison and its samples.

    `generated_at` is the report row's stamp, and it is `null` when the run has
    no report yet — which is the honest answer for a run that has not finished
    measuring. The samples are present either way; a run being measured live can
    be exported mid-flight.
    """

    session: SimulationSessionRead
    generated_at: datetime | None
    samples: list[SimulationMetricRead]
