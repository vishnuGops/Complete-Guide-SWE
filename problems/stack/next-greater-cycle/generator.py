"""Random inputs for next-greater-cycle.

The shapes that matter: strictly decreasing (every answer comes from the wrap),
strictly increasing (only the last wraps), all equal (every answer is -1), and
rows with heavy duplicates, where a non-strict comparison shows up.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([5], "a single reading has no answer")
    yield _case([1, 2], "two readings")
    yield _case([2, 1], "two readings, the wrap answers the second")
    yield _case([5, 5, 5], "every reading equal")
    yield _case([5, 4, 3, 2, 1], "strictly decreasing, so every answer wraps")
    yield _case([1, 2, 3, 4, 5], "strictly increasing")
    yield _case([-(10**9), 10**9], "the extremes of the stated range")

    for n, pool in ((4, 3), (12, 5), (60, 8), (200, 200)):
        yield _case([rng.randint(0, pool) for _ in range(n)])

    yield _case([rng.choice([0, 1]) for _ in range(500)], "only two distinct values")

    for _ in range(2):
        n = rng.randint(500, 2000)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)])

    yield _case(list(range(10**4, 0, -1)), "the stated maximum, strictly decreasing")
