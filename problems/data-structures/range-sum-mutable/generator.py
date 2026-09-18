"""Random operation sequences for range-sum-mutable.

Totals are drawn over the whole row, over single positions and over random
stretches, and `set` is interleaved rather than batched - a run of totals after a
run of changes would never catch a tree that updates the wrong blocks.
"""

import random
from typing import Any, Dict, Iterator, List


def _sequence(readings: List[int], ops: List[Dict[str, Any]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [readings], "ops": ops}
    if name:
        case["name"] = name
    return case


def _run(rng: random.Random, n: int, length: int) -> List[Dict[str, Any]]:
    ops: List[Dict[str, Any]] = []
    for _ in range(length):
        if rng.random() < 0.4:
            ops.append({"method": "set", "args": [rng.randrange(n), rng.randint(-(10**4), 10**4)]})
        else:
            start = rng.randrange(n)
            end = rng.randrange(start, n)
            ops.append({"method": "total", "args": [start, end]})
    return ops


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence([5], [{"method": "total", "args": [0, 0]}], "one reading")
    yield _sequence([1, 2, 3], [{"method": "total", "args": [1, 1]}], "a stretch of one")
    yield _sequence([1, 3, 5], [
        {"method": "total", "args": [0, 2]},
        {"method": "set", "args": [1, 2]},
        {"method": "total", "args": [0, 2]},
    ], "a change between two totals")
    yield _sequence([0, 0, 0, 0], [
        {"method": "total", "args": [0, 3]},
        {"method": "set", "args": [2, 7]},
        {"method": "total", "args": [0, 3]},
        {"method": "total", "args": [2, 2]},
        {"method": "total", "args": [0, 1]},
    ], "a change in the middle of zeroes")
    yield _sequence([10**4, -(10**4)], [
        {"method": "total", "args": [0, 1]},
        {"method": "set", "args": [1, 10**4]},
        {"method": "total", "args": [0, 1]},
    ], "the extremes of the stated range")
    yield _sequence([1] * 8, [{"method": "total", "args": [i, 7]} for i in range(8)],
                    "every suffix of a row of ones")

    for n, length in ((2, 8), (4, 15), (8, 30), (17, 60), (64, 150), (300, 500)):
        readings = [rng.randint(-(10**4), 10**4) for _ in range(n)]
        yield _sequence(readings, _run(rng, n, length))

    # A power of two, and one more than a power of two, where the block sizes
    # line up differently.
    for n in (16, 17):
        readings = [rng.randint(-100, 100) for _ in range(n)]
        yield _sequence(readings, _run(rng, n, 80))

    n = 10**4
    readings = [rng.randint(-(10**4), 10**4) for _ in range(n)]
    yield _sequence(readings, _run(rng, n, 2 * 10**4), "the stated maxima")
