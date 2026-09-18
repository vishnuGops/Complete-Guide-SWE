"""Random inputs for travel-all-cities.

Both symmetric and asymmetric cost grids are generated, since the statement does
not promise symmetry and a solution that assumes it gets the asymmetric ones
wrong. The diagonal is always zero, as the statement requires.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(distance: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [distance]}
    if name:
        case["name"] = name
    return case


def _grid(rng: random.Random, n: int, high: int, symmetric: bool) -> List[List[int]]:
    grid = [[0] * n for _ in range(n)]
    for a in range(n):
        for b in range(n):
            if a == b:
                continue
            if symmetric and b < a:
                grid[a][b] = grid[b][a]
            else:
                grid[a][b] = rng.randint(0, high)
    return grid


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[0]], "one city")
    yield _case([[0, 5], [7, 0]], "two cities")
    yield _case([[0, 1000], [1000, 0]], "the extremes of the stated range")
    yield _case([[0, 1, 15, 6], [2, 0, 7, 3], [9, 6, 0, 12], [10, 4, 8, 0]], "four cities")
    yield _case([[0, 0, 0], [0, 0, 0], [0, 0, 0]], "everything free")
    yield _case([[0, 1, 100], [100, 0, 1], [1, 100, 0]], "a cheap cycle in one direction only")

    for n in (3, 4, 5, 6, 8):
        yield _case(_grid(rng, n, 50, symmetric=True))
        yield _case(_grid(rng, n, 50, symmetric=False))

    yield _case(_grid(rng, 10, 1000, symmetric=True), "ten cities, symmetric")
    yield _case(_grid(rng, 11, 1000, symmetric=False), "eleven cities, asymmetric")
    yield _case(_grid(rng, 12, 1000, symmetric=False), "the stated maximum, asymmetric")
    yield _case(_grid(rng, 12, 1000, symmetric=True), "the stated maximum, symmetric")
