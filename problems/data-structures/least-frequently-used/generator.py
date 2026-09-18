"""Random operation sequences for least-frequently-used.

Keys are drawn from a pool a little larger than the capacity so that evictions
happen constantly, and a few keys are read repeatedly so that the counts spread
out - a sequence where every key has one use would only ever test the tie-break.
"""

import random
from typing import Any, Dict, Iterator, List


def _sequence(capacity: int, ops: List[Dict[str, Any]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [capacity], "ops": ops}
    if name:
        case["name"] = name
    return case


def _run(rng: random.Random, capacity: int, pool: int, length: int, favourites: int) -> List[Dict[str, Any]]:
    hot = list(range(favourites))
    ops: List[Dict[str, Any]] = []
    for _ in range(length):
        key = rng.choice(hot) if hot and rng.random() < 0.4 else rng.randrange(pool)
        if rng.random() < 0.5:
            ops.append({"method": "get", "args": [key]})
        else:
            ops.append({"method": "put", "args": [key, rng.randint(0, 10**5)]})
    return ops


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence(1, [
        {"method": "put", "args": [1, 1]},
        {"method": "get", "args": [1]},
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
    ], "the less used key is evicted")
    yield _sequence(2, [
        {"method": "put", "args": [1, 1]},
        {"method": "put", "args": [2, 2]},
        {"method": "put", "args": [3, 3]},
        {"method": "get", "args": [1]},
    ], "a tie broken by age")
    yield _sequence(2, [{"method": "get", "args": [9]}], "reading an empty cache")
    yield _sequence(2, [
        {"method": "put", "args": [1, 1]},
        {"method": "put", "args": [1, 5]},
        {"method": "put", "args": [2, 2]},
        {"method": "put", "args": [3, 3]},
        {"method": "get", "args": [1]},
        {"method": "get", "args": [2]},
    ], "an overwrite counts as a use")
    yield _sequence(3, [{"method": "put", "args": [i, i]} for i in range(3)]
                    + [{"method": "get", "args": [0]} for _ in range(5)]
                    + [{"method": "put", "args": [3, 3]},
                       {"method": "get", "args": [0]},
                       {"method": "get", "args": [1]}],
                    "one key used far more than the others")

    for capacity, pool, length, favourites in ((1, 4, 15, 1), (2, 5, 30, 2), (3, 7, 50, 2),
                                               (5, 10, 100, 3), (10, 18, 250, 4), (40, 60, 700, 6)):
        yield _sequence(capacity, _run(rng, capacity, pool, length, favourites))

    yield _sequence(200, _run(rng, 200, 100, 400, 10), "a cache that never fills")
    yield _sequence(2000, _run(rng, 2000, 3000, 2 * 10**4, 50), "the stated maxima")
