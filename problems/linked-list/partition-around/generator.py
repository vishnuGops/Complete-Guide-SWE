"""Random inputs for partition-around.

The pivot is chosen from inside and outside the chain's range, so that both
groups are sometimes empty. Values come from small pools so that links equal to
the pivot - which belong in the upper group - happen often.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], pivot: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values, pivot]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], 3, "the empty chain")
    yield _case([1], 1, "one link, equal to the pivot")
    yield _case([1], 2, "one link, below the pivot")
    yield _case([2, 1], 2, "the pivot value belongs above")
    yield _case([5, 5, 5], 1, "nothing below the pivot")
    yield _case([5, 5, 5], 9, "nothing at or above the pivot")
    yield _case([-(10**9), 10**9], 0, "the extremes of the stated range")

    for n, pool in ((5, 4), (18, 6), (70, 10), (300, 3)):
        values = [rng.randint(0, pool) for _ in range(n)]
        yield _case(values, rng.randint(0, pool))

    for _ in range(2):
        n = rng.randint(500, 2000)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)], rng.randint(-(10**9), 10**9))

    yield _case(
        [rng.randint(-100, 100) for _ in range(10**4)],
        0,
        "the stated maximum, split roughly in half",
    )
