"""Random inputs for cheapest-grid-path.

Grids where a greedy first step is wrong are generated deliberately - a cheap
cell leading into an expensive region - alongside uniform grids, zero grids and
the single row and column, where the edge handling is what is being tested.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(tolls: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [tolls]}
    if name:
        case["name"] = name
    return case


def _grid(rng: random.Random, rows: int, columns: int, high: int) -> List[List[int]]:
    return [[rng.randint(0, high) for _ in range(columns)] for _ in range(rows)]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[5]], "one cell")
    yield _case([[0]], "one cell of no toll")
    yield _case([[1, 2, 3]], "a single row")
    yield _case([[1], [2], [3]], "a single column")
    yield _case([[1, 3, 1], [1, 5, 1], [4, 2, 1]], "three by three")
    yield _case([[100, 100], [100, 100]], "the extremes of the stated toll range")
    yield _case([[0, 100], [1, 0]], "a greedy first step is wrong")
    yield _case([[0, 0, 0], [0, 0, 0]], "every toll zero")

    for rows, columns, high in ((2, 2, 9), (3, 5, 20), (6, 4, 50), (10, 10, 100), (4, 12, 3)):
        yield _case(_grid(rng, rows, columns, high))
        yield _case(_grid(rng, rows, columns, high))

    yield _case(_grid(rng, 200, 200, 100), "the stated maximum")
    yield _case(_grid(rng, 1, 200, 100), "the stated maximum, one row deep")
    yield _case(_grid(rng, 200, 1, 100), "the stated maximum, one column wide")
    yield _case([[0] * 200 for _ in range(200)], "the stated maximum, all free")
