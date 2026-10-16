"""Arrivals: the traffic a run is fed, generated from the operator's config.

The backend has to reproduce the *demand curve*, not the browser's exact stream.
`frontend/src/simulation/runner.ts` maps the operator's single `quietRatePerMinute`
onto a per-lane base and peak, and the world swells between them on two sines; the
same mapping and the same two sine periods are restated here so the two engines
are fed traffic of the same character. What is deliberately different is the
random draw itself: the browser's mulberry32 is consumed by paint and movement
choices that have no meaning in a queueing model, so matching it draw for draw
would be matching noise. A seeded `random.Random` gives what this side actually
needs — a run that repeats exactly for a given seed, which is the prerequisite for
any measurement.

The output is a plain list of `Arrival`s, and that is the point: the benchmark
replays one list through both controllers, so "adaptive vs fixed on the same
vehicle sequence" is literally true rather than two runs that happened to look
alike.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

from app.services.simulation.state import ARMS, LANES_PER_ARM, Arm, Arrival

#: Vehicles per second per lane at the quietest and busiest points of the demand
#: cycle. `world.ts`'s `DEFAULT_BASE_RATE` / `DEFAULT_PEAK_RATE`; the ratio between
#: them is what turns the operator's one quiet-rate slider into a whole curve.
DEFAULT_BASE_RATE = 0.115
DEFAULT_PEAK_RATE = 0.29

#: The kinds the operator weighs, in the order the config screen lists them.
ORDINARY_KINDS: tuple[str, ...] = ("sedan", "hatchback", "taxi", "van", "bus")

#: Police are ordinary traffic whose share the fleet fixes, so they are in the
#: arriving stream but not in the operator's mix — the same asymmetry `fleet.ts`
#: draws between `police` and the ambulance.
POLICE_KIND = "police"
POLICE_WEIGHT = 4.0

#: The two kinds the model spawns deliberately, alternating, to demonstrate
#: preemption. Never drawn from the ordinary stream.
EMERGENCY_KINDS: tuple[str, ...] = ("ambulance", "firetruck")

#: The mix a config falls back to when every ordinary kind is zero. The schema
#: refuses an all-zero config, so this only guards a direct caller — and returning
#: a road of only sedans (what a zero total would produce) is the opposite of the
#: "start over" the operator would have meant.
DEFAULT_TYPE_WEIGHTS: dict[str, float] = {
    "sedan": 30.0,
    "hatchback": 22.0,
    "taxi": 13.0,
    "van": 15.0,
    "bus": 6.0,
}

#: Seconds to the first emergency vehicle, and between subsequent ones. The
#: browser's own windows, so the demonstration's rhythm is the same on this side.
EMERGENCY_FIRST = (26.0, 44.0)
EMERGENCY_REPEAT = (34.0, 58.0)

#: The seed the browser's world defaults to; reused so a bare benchmark is
#: reproducible without anyone having to pass a number.
DEFAULT_SEED = 20260929


@dataclass
class GeneratorConfig:
    """Everything that shapes the arriving stream."""

    quiet_rate_per_minute: float
    type_weights: dict[str, float]
    seed: int = DEFAULT_SEED
    include_emergency: bool = True
    warm_up: bool = True
    #: Optional per-approach multipliers. Uniform by default, which is the
    #: browser's symmetric junction. A benchmark skews them to create the
    #: imbalance a control policy can actually win on; it is an evaluation tool,
    #: not something the operator's config exposes.
    arm_weights: dict[Arm, float] = field(default_factory=dict)


def _demand(t: float, base: float, peak: float) -> float:
    """Vehicles per second per lane at time `t`, along the browser's two-sine curve.

    Two sines at incommensurate periods so the swell never repeats on an interval
    a viewer could count; a single sine is visibly a sine, and a visibly periodic
    junction reads as a loop rather than as traffic.
    """
    slow = math.sin(t / 61.0)
    quick = math.sin(t / 19.0 + 1.7)
    unit = 0.5 + 0.34 * slow + 0.16 * quick
    return base + (peak - base) * min(1.0, max(0.0, unit))


def _resolve_weights(type_weights: dict[str, float]) -> dict[str, float]:
    """The ordinary mix, with the police share appended at the fleet's fixed weight.

    Ordinary weights come straight from the operator; police do not, and are not
    counted toward the all-zero fallback, because a junction with the operator's
    every slider at zero still has patrol cars on it.
    """
    weights = {kind: max(0.0, float(type_weights.get(kind, 0.0))) for kind in ORDINARY_KINDS}
    if sum(weights.values()) <= 0:
        weights = dict(DEFAULT_TYPE_WEIGHTS)
    weights[POLICE_KIND] = POLICE_WEIGHT
    return weights


def _weighted(rng: random.Random, weights: dict[str, float]) -> str:
    """Pick a key in proportion to its weight, in insertion order.

    The same walk as `Random.weighted` in `fleet.ts`: a threshold in `[0, total)`
    that each weight decrements in turn. Written out rather than delegated to
    `random.choices` so the selection order — and therefore a seed's output — is
    the config screen's order and not the standard library's.
    """
    total = sum(weights.values())
    threshold = rng.random() * total
    for key, weight in weights.items():
        threshold -= weight
        if threshold <= 0:
            return key
    return next(iter(weights))


def generate(config: GeneratorConfig, duration: float) -> list[Arrival]:
    """Build the arrival sequence for a run of `duration` seconds.

    Per lane, as the browser generates: each of the eight lanes runs its own
    arrival clock, advanced by the current demand, so the two lanes of an approach
    fill independently. Emergency vehicles are placed on top, on their own
    schedule, because they are a demonstration of preemption and not a share of
    ordinary traffic.
    """
    rng = random.Random(config.seed)
    weights = _resolve_weights(config.type_weights)

    total_lanes = len(ARMS) * LANES_PER_ARM
    quiet_per_lane = config.quiet_rate_per_minute / 60.0 / total_lanes
    base = quiet_per_lane
    peak = quiet_per_lane * (DEFAULT_PEAK_RATE / DEFAULT_BASE_RATE)

    arrivals: list[Arrival] = []

    if config.warm_up:
        # Pre-fill each approach so the junction is at steady state on the first
        # tick. A scene that starts empty spends its first half-minute looking
        # broken, and that transient would land in the benchmark's first window and
        # flatter whichever controller happened to be served first.
        for arm in ARMS:
            count = 2 + (1 if arm is Arm.NORTH else 0)
            for index in range(LANES_PER_ARM):
                for _ in range(count):
                    arrivals.append(
                        Arrival(t=0.0, arm=arm, lane=index, kind=_weighted(rng, weights))
                    )

    for arm in ARMS:
        weight = config.arm_weights.get(arm, 1.0)
        if weight <= 0:
            continue
        for index in range(LANES_PER_ARM):
            t = rng.uniform(0.0, 3.0)
            while True:
                rate = _demand(t, base, peak) * weight
                if rate <= 0:
                    break
                t += 1.0 / rate
                if t >= duration:
                    break
                arrivals.append(
                    Arrival(t=t, arm=arm, lane=index, kind=_weighted(rng, weights))
                )

    if config.include_emergency:
        arrivals.extend(_emergency_arrivals(rng, duration))

    # A stable sort, so arrivals stamped at the same instant — the warm-up's t=0
    # among them — keep the order they were created in.
    arrivals.sort(key=lambda arrival: arrival.t)
    return arrivals


def _emergency_arrivals(rng: random.Random, duration: float) -> list[Arrival]:
    """The deliberate emergency stream: alternating kinds, on a random approach."""
    arrivals: list[Arrival] = []
    last_emergency = EMERGENCY_KINDS[-1]
    t = rng.uniform(*EMERGENCY_FIRST)

    while t < duration:
        kind = "ambulance" if last_emergency == "firetruck" else "firetruck"
        arm = rng.choice(ARMS)
        lane = rng.randrange(LANES_PER_ARM)
        arrivals.append(
            Arrival(t=t, arm=arm, lane=lane, kind=kind, emergency=True)
        )
        last_emergency = kind
        t += rng.uniform(*EMERGENCY_REPEAT)

    return arrivals
