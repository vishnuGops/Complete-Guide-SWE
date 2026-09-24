"""Sorted reading series for first-not-below.

Thresholds are drawn to land before, inside, on and after the data, because the
boundary cases are the whole point of this problem.
"""

import random
from typing import Any, Dict, Iterator, List


def _sorted_values(rng: random.Random, n: int, span: int) -> List[int]:
    return sorted(rng.randint(-span, span) for _ in range(n))


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[], 5], "name": "empty list"}
    yield {"args": [[1], 0], "name": "single reading, threshold below"}
    yield {"args": [[1], 1], "name": "single reading, threshold equal"}
    yield {"args": [[1], 2], "name": "single reading, threshold above"}
    yield {"args": [[2, 2, 2, 2], 2], "name": "all equal to the threshold"}
    yield {"args": [[1, 1, 2, 2, 3, 3], 2], "name": "repeats, first match in the middle"}
    yield {"args": [[-(10**9), 0, 10**9], -(10**9)], "name": "extreme lower bound"}
    yield {"args": [[-(10**9), 0, 10**9], 10**9], "name": "extreme upper bound"}

    for n in (2, 9, 33, 128):
        values = _sorted_values(rng, n, 50)
        yield {"args": [values, rng.randint(-60, 60)]}

    for _ in range(3):
        n = rng.randint(500, 2000)
        values = _sorted_values(rng, n, 10**6)
        threshold = rng.choice([values[0], values[-1], rng.randint(-(10**6), 10**6)])
        yield {"args": [values, threshold]}

    # One short of the bound on each side, so a threshold of 10^9 is above
    # everything and still inside the stated range.
    big = _sorted_values(rng, 2000, 10**9 - 1)
    yield {"args": [big, big[len(big) // 3]], "name": "maximum size, target present"}
    yield {"args": [big, 10**9], "name": "maximum size, above everything"}
