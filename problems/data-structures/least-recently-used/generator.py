"""Random operation sequences for least-recently-used.

Keys are drawn from a pool a little larger than the capacity, so evictions happen
constantly, and reads are frequent enough that recency genuinely reorders things
- a sequence of writes alone would make the cache behave like a queue and test
nothing.
"""

import random
from typing import Any, Dict, Iterator, List


def _sequence(capacity: int, ops: List[Dict[str, Any]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [capacity], "ops": ops}
    if name:
        case["name"] = name
    return case


def _run(rng: random.Random, capacity: int, pool: int, length: int) -> List[Dict[str, Any]]:
    ops: List[Dict[str, Any]] = []
    for _ in range(length):
        key = rng.randrange(pool)
        if rng.random() < 0.45:
            ops.append({"method": "get", "args": [key]})
        else:
            ops.append({"method": "put", "args": [key, rng.randint(0, 10**5)]})
    return ops


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence(1, [
        {"method": "put", "args": [1, 1]},
        {"method": "put", "args": [2, 2]},
        {"method": "get", "args": [1]},
    ], "a cache of one")
    yield _sequence(2, [
        {"method": "put", "args": [1, 1]},
        {"method": "put", "args": [2, 2]},
        {"method": "get", "args": [1]},
        {"method": "put", "args": [3, 3]},
        {"method": "get", "args": [2]},
        {"method": "get", "args": [3]},
    ], "a read changes what is evicted")
    yield _sequence(2, [
        {"method": "put", "args": [1, 1]},
        {"method": "put", "args": [1, 5]},
        {"method": "get", "args": [1]},
    ], "overwriting a key")
    yield _sequence(2, [{"method": "get", "args": [9]}], "reading an empty cache")
    yield _sequence(3, [{"method": "put", "args": [i, i]} for i in range(6)]
                    + [{"method": "get", "args": [i]} for i in range(6)],
                    "six keys through a cache of three")
    yield _sequence(2, [
        {"method": "put", "args": [0, 0]},
        {"method": "put", "args": [10**5, 10**5]},
        {"method": "get", "args": [0]},
        {"method": "get", "args": [10**5]},
    ], "the extremes of the stated ranges")

    for capacity, pool, length in ((1, 4, 15), (2, 5, 30), (3, 6, 40), (5, 8, 80),
                                   (10, 15, 200), (50, 60, 600)):
        yield _sequence(capacity, _run(rng, capacity, pool, length))

    # Capacity never reached, so nothing is ever evicted.
    yield _sequence(100, _run(rng, 100, 20, 300), "a cache that never fills")

    yield _sequence(3000, _run(rng, 3000, 4000, 2 * 10**4), "the stated maxima")
