"""Random operation sequences for kth-largest-stream.

Every sequence is built so that at least `k` readings exist before the first
`add` returns - either the initial batch is already that long, or the adds
before the first answer make it so. Values are drawn from small pools in half
the cases, because duplicates counting separately is the rule most often got
wrong.
"""

import random
from typing import Any, Dict, Iterator, List


def _sequence(rng: random.Random, k: int, first: List[int], adds: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {
        "args": [k, first],
        "ops": [{"method": "add", "args": [value]} for value in adds],
    }
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence(rng, 3, [4, 5, 8, 2], [3, 5, 10], "the third largest, updated")
    yield _sequence(rng, 1, [], [-1, -5, -3], "k of one is the maximum")
    yield _sequence(rng, 2, [7, 7], [7, 7], "duplicates count separately")
    yield _sequence(rng, 1, [], [10**9, -(10**9)], "the extremes of the stated range")
    yield _sequence(rng, 4, [1, 2, 3, 4], [0, 0, 0], "readings that never beat the heap")
    yield _sequence(rng, 2, [1, 2], [3, 4, 5, 6], "readings that always beat the heap")

    for k, initial, adds, pool in ((1, 3, 6, 5), (3, 2, 10, 20), (5, 8, 15, 6), (4, 20, 30, 1000)):
        # The batch plus the first add must already hold k readings, or the
        # first answer would be asked for before it exists.
        initial = max(initial, k - 1)
        first = [rng.randint(-pool, pool) for _ in range(initial)]
        values = [rng.randint(-pool, pool) for _ in range(adds)]
        yield _sequence(rng, k, first, values)

    for _ in range(2):
        k = rng.randint(1, 50)
        first = [rng.randint(-(10**9), 10**9) for _ in range(rng.randint(k, 200))]
        adds = [rng.randint(-(10**9), 10**9) for _ in range(rng.randint(50, 300))]
        yield _sequence(rng, k, first, adds)

    k = 10**4
    first = [rng.randint(-(10**9), 10**9) for _ in range(10**4)]
    adds = [rng.randint(-(10**9), 10**9) for _ in range(10**4)]
    yield _sequence(rng, k, first, adds, "the stated maxima")
