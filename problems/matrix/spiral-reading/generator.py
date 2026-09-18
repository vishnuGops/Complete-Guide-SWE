"""Random inputs for spiral-reading.

Every small shape is covered on purpose: a single row, a single column, one
cell, and grids whose rings run out mid-way. Values are the cells' own positions
in most cases, which makes a wrong order obvious when a test fails.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(grid: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [grid]}
    if name:
        case["name"] = name
    return case


def _numbered(rows: int, columns: int) -> List[List[int]]:
    return [[row * columns + column for column in range(columns)] for row in range(rows)]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[1]], "one cell")
    yield _case([[1, 2, 3, 4]], "a single row")
    yield _case([[1], [2], [3]], "a single column")
    yield _case(_numbered(2, 2), "two by two")
    yield _case(_numbered(3, 3), "three by three, with a centre cell")
    yield _case(_numbered(4, 4), "four by four, with a centre ring")
    yield _case([[-(10**9), 10**9]], "the extremes of the stated value range")

    for rows, columns in ((1, 7), (7, 1), (2, 5), (5, 2), (3, 8), (8, 3), (6, 6)):
        yield _case(_numbered(rows, columns))

    for _ in range(3):
        rows = rng.randint(1, 20)
        columns = rng.randint(1, 20)
        yield _case([[rng.randint(-(10**9), 10**9) for _ in range(columns)] for _ in range(rows)])

    yield _case(_numbered(100, 100), "the stated maximum")
    yield _case(_numbered(1, 100), "the stated maximum as a single row")
    yield _case(_numbered(100, 1), "the stated maximum as a single column")
