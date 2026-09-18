"""Random inputs for insert-position.

Targets are drawn from inside the row, from the gaps, and from outside it on
both sides. Duplicates are common on purpose: the answer is the first position
not below the target, and a search that finds any occurrence gets them wrong.
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
    yield _case([5], 5, "a single reading, equal")
    yield _case([5], 4, "a single reading, target below")
    yield _case([5], 6, "a single reading, target above")
    yield _case([1, 1, 1, 1], 1, "every reading equal to the target")
    yield _case([-(10**9), 10**9], 0, "the extremes of the stated range")

    for n, spread in ((4, 10), (17, 40), (60, 30), (250, 100)):
        row = sorted(rng.randint(-spread, spread) for _ in range(n))
        yield _case(row, rng.randint(-spread - 5, spread + 5))
        yield _case(row, row[rng.randrange(n)])

    # A row of two distinct values, so the boundary is deep inside a run.
    row = sorted([1] * 300 + [9] * 300)
    yield _case(row, 9, "the boundary between two long runs")
    yield _case(row, 5, "a target in the gap between two long runs")

    n = 10**4
    row = sorted(rng.randint(-(10**9), 10**9) for _ in range(n))
    yield _case(row, rng.randint(-(10**9), 10**9), "the stated maximum")
