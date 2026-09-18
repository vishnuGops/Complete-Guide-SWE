"""Random inputs for surrounded-regions.

Plans are drawn at several wall densities, with a walled border added to half of
them so that enclosed regions actually occur - in an open plan almost everything
reaches the edge and nothing is filled.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(plan: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [plan]}
    if name:
        case["name"] = name
    return case


def _plan(rng: random.Random, rows: int, columns: int, wall: float, border: bool) -> List[List[int]]:
    out = [[1 if rng.random() < wall else 0 for _ in range(columns)] for _ in range(rows)]
    if border:
        for row in range(rows):
            out[row][0] = 1
            out[row][columns - 1] = 1
        for column in range(columns):
            out[0][column] = 1
            out[rows - 1][column] = 1
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[0]], "a single open cell")
    yield _case([[1]], "a single wall")
    yield _case([[1, 1, 1], [1, 0, 1], [1, 1, 1]], "a cell walled in on all sides")
    yield _case([[1, 1, 1], [1, 0, 1], [1, 0, 1]], "a region reaching the bottom edge")
    yield _case([[0, 0], [0, 0]], "entirely open")
    yield _case([[1, 1], [1, 1]], "entirely wall")
    yield _case([[1, 1, 1], [1, 0, 1], [1, 1, 0]], "a diagonal gap does not let a region out")

    for rows, columns, wall, border in (
        (3, 3, 0.4, True),
        (5, 5, 0.3, True),
        (6, 8, 0.45, False),
        (8, 8, 0.35, True),
        (10, 10, 0.5, False),
    ):
        yield _case(_plan(rng, rows, columns, wall, border))
        yield _case(_plan(rng, rows, columns, wall, border))

    for _ in range(2):
        size = rng.randint(20, 50)
        yield _case(_plan(rng, size, size, rng.choice([0.3, 0.45]), rng.random() < 0.5))

    yield _case([[0] * 100 for _ in range(100)], "the stated maximum, entirely open")
    yield _case(_plan(rng, 100, 100, 0.4, True), "the stated maximum, walled in")
