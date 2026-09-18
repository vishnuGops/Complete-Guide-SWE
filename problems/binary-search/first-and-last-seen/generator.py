"""Random inputs for first-and-last-seen.

Runs of duplicates are the whole point, so the rows are built from small pools
of values. Targets are drawn from the row itself, from the gaps between values,
and from outside it entirely.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(readings: List[int], target: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [readings, target]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], 5, "an empty row")
    yield _case([5], 5, "a single reading, present")
    yield _case([5], 4, "a single reading, absent")
    yield _case([2, 2, 2], 2, "the target fills the row")
    yield _case([1, 2, 3], 4, "the target is above everything")
    yield _case([1, 2, 3], 0, "the target is below everything")
    yield _case([-(10**9), 10**9], 10**9, "the extremes of the stated range")

    for n, pool in ((6, 3), (20, 5), (80, 10), (400, 4)):
        row = sorted(rng.randint(0, pool) for _ in range(n))
        yield _case(row, rng.randint(0, pool))
        yield _case(row, pool + 1)

    # A long run of one value with a handful of others either side.
    row = sorted([0] * 5 + [7] * 2000 + [9] * 5)
    yield _case(row, 7, "a run of two thousand")
    yield _case(row, 8, "a gap between two runs")

    n = 10**5
    row = sorted(rng.randint(-(10**9), 10**9) for _ in range(n))
    yield _case(row, row[rng.randrange(n)], "the stated maximum")
