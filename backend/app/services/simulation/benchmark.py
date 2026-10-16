"""Benchmark the two policies on one arrival sequence, and export the result.

The product's claim is comparative — adaptive beats fixed — so the measurement has
to be comparative too: one `generate` call, one arrival list, played through both
controllers. Two separate generations would only show that two runs looked
different, which is not a claim about the policy at all.

`compare` returns the pair of `Metrics` and `to_csv` renders them as the artifact
`PLAN.md`'s Phase 3 asks for. Run the module directly to print a benchmark of the
asymmetric case the policy is meant to win on.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass

from app.services.algorithm import AdaptiveController, FixedController
from app.services.simulation.state import Arm, Metrics, run
from app.services.simulation.vehicle_generator import (
    DEFAULT_TYPE_WEIGHTS,
    GeneratorConfig,
    generate,
)

#: Ten minutes: long enough for several full cycles and a handful of emergency
#: vehicles, short enough that a benchmark in a commit hook is not a coffee break.
DEFAULT_DURATION = 600.0

#: A busy avenue cross a quiet street. Adaptive has something to win here — a
#: balanced junction gives a fixed plan little to lose — and the skew is a
#: deliberate evaluation tool, not something the operator's config exposes.
BENCHMARK_ARM_WEIGHTS: dict[Arm, float] = {
    Arm.NORTH: 2.0,
    Arm.SOUTH: 2.0,
    Arm.EAST: 0.6,
    Arm.WEST: 0.6,
}


@dataclass(frozen=True)
class Comparison:
    """One sequence, two strategies, and how many vehicles they shared."""

    adaptive: Metrics
    fixed: Metrics
    arrivals: int


def compare(
    config: GeneratorConfig,
    duration: float = DEFAULT_DURATION,
) -> Comparison:
    """Play one generated sequence through both controllers."""
    arrivals = generate(config, duration)
    adaptive = run(arrivals, AdaptiveController()).snapshot()
    fixed = run(arrivals, FixedController()).snapshot()
    return Comparison(adaptive=adaptive, fixed=fixed, arrivals=len(arrivals))


def _number(value: float | int) -> str:
    """A queue length prints as an integer; a duration keeps three decimals."""
    return str(value) if isinstance(value, int) else f"{value:.3f}"


def to_csv(comparison: Comparison) -> str:
    """Render the comparison as `metric,adaptive,fixed` rows."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(["metric", "adaptive", "fixed"])
    rows: list[tuple[str, float | int, float | int]] = [
        (
            "averageWaitSeconds",
            comparison.adaptive.average_wait_seconds,
            comparison.fixed.average_wait_seconds,
        ),
        (
            "throughputPerMinute",
            comparison.adaptive.throughput_per_minute,
            comparison.fixed.throughput_per_minute,
        ),
        (
            "emergencyResponseSeconds",
            comparison.adaptive.emergency_response_seconds,
            comparison.fixed.emergency_response_seconds,
        ),
        ("longestQueue", comparison.adaptive.longest_queue, comparison.fixed.longest_queue),
    ]
    for name, adaptive, fixed in rows:
        writer.writerow([name, _number(adaptive), _number(fixed)])
    return buffer.getvalue()


def main() -> None:
    """Print the benchmark CSV — the Phase 3 artifact — to stdout."""
    config = GeneratorConfig(
        quiet_rate_per_minute=30.0,
        type_weights=dict(DEFAULT_TYPE_WEIGHTS),
        arm_weights=dict(BENCHMARK_ARM_WEIGHTS),
    )
    print(to_csv(compare(config)), end="")


if __name__ == "__main__":
    main()
