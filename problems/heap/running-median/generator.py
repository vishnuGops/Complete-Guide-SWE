"""Random operation sequences for running-median.

Ascending and descending streams are included on purpose: they are the shapes
where every reading lands on the same side and the rebalancing does all the
work. Small pools give heavy duplicates, and the extremes check the averaging.
"""

import random
from typing import Any, Dict, Iterator, List


def _sequence(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {
        "args": [],
        "ops": [{"method": "add", "args": [value]} for value in values],
    }
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence([1], "a single reading")
    yield _sequence([1, 2, 3], "three readings")
    yield _sequence([5, 5], "duplicates")
    yield _sequence([-(10**9), 10**9], "the extremes of the stated range")
    yield _sequence([10**9, 10**9], "two readings at the top of the range")
    # The two middle readings sum past a 32-bit int on the negative side, and
    # again mid-stream rather than on the second call.
    yield _sequence([-(10**9), -(10**9) + 1], "two readings at the bottom of the range")
    yield _sequence(
        [10**9 - 5, -3, 10**9 - 1, 10**9 - 2, 10**9, 10**9 - 4],
        "middles near 10^9, mid-stream",
    )
    yield _sequence(list(range(1, 21)), "strictly ascending")
    yield _sequence(list(range(20, 0, -1)), "strictly descending")
    yield _sequence([7] * 15, "every reading the same")

    for n, pool in ((4, 3), (15, 10), (60, 5), (200, 1000)):
        yield _sequence([rng.randint(-pool, pool) for _ in range(n)])

    # Alternating extremes, so every reading crosses the middle.
    yield _sequence([(-1) ** i * (i + 1) for i in range(100)], "alternating high and low")

    for _ in range(2):
        n = rng.randint(500, 2000)
        yield _sequence([rng.randint(-(10**9), 10**9) for _ in range(n)])

    yield _sequence([rng.randint(-(10**9), 10**9) for _ in range(10**4)], "the stated maximum")
