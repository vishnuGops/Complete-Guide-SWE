"""Random inputs for smallest-range-k.

Series are built sorted and non-empty. Two shapes matter: series drawn from the
same narrow band, where the answer has width zero or close to it, and series
drawn from disjoint bands, where the answer has to span them.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(series: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [series]}
    if name:
        case["name"] = name
    return case


def _series(rng: random.Random, k: int, each: int, low: int, high: int) -> List[List[int]]:
    return [sorted(rng.randint(low, high) for _ in range(each)) for _ in range(k)]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[5]], "a single series of one reading")
    yield _case([[1, 2, 3]], "a single series")
    yield _case([[1], [2]], "two series of one reading each")
    yield _case([[1, 2, 3], [1, 2, 3], [1, 2, 3]], "a value shared by every series")
    yield _case([[4, 10, 15, 24], [0, 9, 12, 20], [5, 18, 22, 30]], "three series")
    yield _case([[-(10**5)], [10**5]], "the extremes of the stated range")
    yield _case([[1, 1, 1], [1, 1, 1]], "every reading the same")

    for k, each, spread in ((2, 4, 20), (3, 6, 50), (5, 10, 30), (8, 12, 200)):
        yield _case(_series(rng, k, each, -spread, spread))

    # Disjoint bands, so the answer has to span all of them.
    yield _case([sorted(rng.randint(band * 100, band * 100 + 20) for _ in range(6))
                 for band in range(6)], "six disjoint bands")

    # Very uneven lengths, so one series runs out long before the others.
    yield _case([[0], sorted(rng.randint(-50, 50) for _ in range(500))],
                "one series of a single reading beside a long one")

    for _ in range(2):
        k = rng.randint(20, 100)
        yield _case(_series(rng, k, rng.randint(5, 40), -(10**5), 10**5))

    k = 3000
    yield _case(_series(rng, k, 3, -(10**5), 10**5), "the stated maximum number of series")
    yield _case(_series(rng, 10, 1000, -(10**5), 10**5), "the stated maximum number of readings")
