"""Random inputs for k-closest-to-origin.

Coordinates are drawn from small ranges in most cases, so that points at exactly
the same distance are common - the tie rule is what a solution usually gets
wrong, and a wide range would almost never produce one.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(points: List[List[int]], k: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [points, k]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[0, 0]], 1, "the origin itself")
    yield _case([[4, 2], [-1, -3]], 1, "one point wanted")
    yield _case([[2, -5], [4, 4], [-3, 1]], 2, "two of three")
    yield _case([[1, 0], [0, 1]], 2, "a tie broken by x")
    yield _case([[1, 1], [1, -1], [-1, 1], [-1, -1]], 4, "four points all one ring away")
    yield _case([[-(10**4), -(10**4)], [10**4, 10**4]], 2, "the extremes of the stated range")

    for n, spread in ((3, 2), (10, 3), (50, 5), (200, 30)):
        points = [[rng.randint(-spread, spread), rng.randint(-spread, spread)] for _ in range(n)]
        yield _case(points, rng.randint(1, n))
        yield _case(points, 1)
        yield _case(points, n)

    # A ring: every point exactly the same distance away.
    ring = [[x, y] for x in (-3, 0, 3) for y in (-4, 0, 4) if x * x + y * y == 25]
    yield _case(ring, len(ring), "every point the same distance away")

    for _ in range(2):
        n = rng.randint(1000, 5000)
        points = [[rng.randint(-100, 100), rng.randint(-100, 100)] for _ in range(n)]
        yield _case(points, rng.randint(1, 50))

    n = 10**5
    points = [[rng.randint(-(10**4), 10**4), rng.randint(-(10**4), 10**4)] for _ in range(n)]
    yield _case(points, 20, "the stated maximum")
    points = [[rng.randint(-5, 5), rng.randint(-5, 5)] for _ in range(n)]
    yield _case(points, 30, "the stated maximum, with ties everywhere")
