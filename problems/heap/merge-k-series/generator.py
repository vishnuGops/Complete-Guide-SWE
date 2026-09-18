"""Random inputs for merge-k-series.

The shapes that matter: no series at all, every series empty, one series holding
everything, and ten thousand series of a single reading - which is where folding
them in one at a time cannot finish.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(series: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [series]}
    if name:
        case["name"] = name
    return case


def _series(rng: random.Random, k: int, total: int, spread: int) -> List[List[int]]:
    values = [rng.randint(-spread, spread) for _ in range(total)]
    buckets: List[List[int]] = [[] for _ in range(k)]
    for value in values:
        buckets[rng.randrange(k)].append(value)
    return [sorted(bucket) for bucket in buckets]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], "no series at all")
    yield _case([[]], "one empty series")
    yield _case([[], [], []], "every series empty")
    yield _case([[1]], "one series of one reading")
    yield _case([[], [1], []], "empty series among the rest")
    yield _case([[1, 4, 5], [1, 3, 4], [2, 6]], "three series")
    yield _case([[-(10**9)], [10**9]], "the extremes of the stated range")
    yield _case([[1, 2, 3, 4, 5]], "one series holding everything")

    for k, total in ((2, 8), (4, 20), (9, 60), (30, 200)):
        yield _case(_series(rng, k, total, 50))

    yield _case([[5] for _ in range(200)], "two hundred series of the same single value")

    for _ in range(2):
        k = rng.randint(50, 400)
        yield _case(_series(rng, k, rng.randint(500, 2000), 10**9))

    yield _case(
        [[rng.randint(-(10**9), 10**9)] for _ in range(10**4)],
        "ten thousand series of one reading, where folding one at a time cannot finish",
    )
