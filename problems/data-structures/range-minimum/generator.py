"""Random operation sequences for range-minimum.

Rows of a power-of-two length and one more than one are both generated, since
the tree's shape differs between them and the query's odd-index tests are where
an off-by-one hides. Changes are interleaved with queries rather than batched.
"""

import random
from typing import Any, Dict, Iterator, List


def _sequence(readings: List[int], ops: List[Dict[str, Any]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [readings], "ops": ops}
    if name:
        case["name"] = name
    return case


def _run(rng: random.Random, n: int, length: int, spread: int) -> List[Dict[str, Any]]:
    ops: List[Dict[str, Any]] = []
    for _ in range(length):
        if rng.random() < 0.4:
            ops.append({"method": "set", "args": [rng.randrange(n), rng.randint(-spread, spread)]})
        else:
            start = rng.randrange(n)
            end = rng.randrange(start, n)
            ops.append({"method": "smallest", "args": [start, end]})
    return ops


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence([5], [{"method": "smallest", "args": [0, 0]}], "one reading")
    yield _sequence([4, 4, 4], [{"method": "smallest", "args": [1, 2]}], "every reading equal")
    yield _sequence([1, 3, 5, 2], [
        {"method": "smallest", "args": [0, 3]},
        {"method": "set", "args": [0, 9]},
        {"method": "smallest", "args": [0, 3]},
    ], "a change removes the smallest")
    yield _sequence([-1, -2, -3], [
        {"method": "smallest", "args": [0, 2]},
        {"method": "smallest", "args": [0, 0]},
        {"method": "set", "args": [2, 0]},
        {"method": "smallest", "args": [0, 2]},
    ], "every reading negative")
    yield _sequence([-(10**9), 10**9], [
        {"method": "smallest", "args": [0, 1]},
        {"method": "set", "args": [0, 10**9]},
        {"method": "smallest", "args": [0, 1]},
    ], "the extremes of the stated range")
    yield _sequence([3, 1, 4, 1, 5], [{"method": "smallest", "args": [i, j]}
                                      for i in range(5) for j in range(i, 5)],
                    "every stretch of a row of five")

    for n, length in ((2, 8), (3, 12), (8, 30), (9, 30), (16, 60), (17, 60), (100, 200)):
        readings = [rng.randint(-1000, 1000) for _ in range(n)]
        yield _sequence(readings, _run(rng, n, length, 1000))

    n = 10**4
    readings = [rng.randint(-(10**9), 10**9) for _ in range(n)]
    yield _sequence(readings, _run(rng, n, 2 * 10**4, 10**9), "the stated maxima")
