"""Random inputs for meeting-room-count.

Random intervals over a wide range rarely overlap, so most cases draw their
starts from a narrow range and their lengths from a wide one. The shapes that
matter: back-to-back bookings (which must share a room), a nest of bookings all
containing one another (the answer is n), and disjoint bookings (the answer is
1).
"""

import random
from typing import Any, Dict, Iterator, List


def _case(bookings: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [bookings]}
    if name:
        case["name"] = name
    return case


def _random(rng: random.Random, n: int, spread: int, length: int) -> List[List[int]]:
    out = []
    for _ in range(n):
        start = rng.randint(0, spread)
        out.append([start, start + rng.randint(1, length)])
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[0, 1]], "a single booking")
    yield _case([[0, 10**9]], "the extremes of the stated range")
    yield _case([[1, 2], [2, 3], [3, 4]], "back to back, sharing one room")
    yield _case([[0, 10], [1, 9], [2, 8], [3, 7]], "each booking inside the last")
    yield _case([[0, 1], [5, 6], [10, 11]], "entirely disjoint")
    yield _case([[5, 6], [0, 1], [10, 11]], "disjoint and out of order")

    for n, spread, length in ((4, 10, 5), (15, 50, 20), (60, 100, 40), (200, 1000, 3)):
        yield _case(_random(rng, n, spread, length))

    # Every booking spans the same moment, so the answer is n.
    n = 300
    yield _case([[rng.randint(0, 100), rng.randint(200, 300)] for _ in range(n)], "all overlapping")

    for _ in range(2):
        n = rng.randint(400, 900)
        yield _case(_random(rng, n, 10**9 - 1000, 1000))

    # The stated maximum, with times spread across the full range so that a
    # per-minute timeline is impossible and a pairwise scan cannot finish.
    yield _case(
        _random(rng, 10**4, 10**9 - 10**6, 10**6),
        "the stated maximum, over the full time range",
    )
