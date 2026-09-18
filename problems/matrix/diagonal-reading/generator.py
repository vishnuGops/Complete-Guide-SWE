"""Random inputs for diagonal-reading.

Wide grids and tall grids in equal measure, because the two inner bounds are not
symmetric and a solution that only clamps one of them passes on square grids.
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
    yield _case([[1, 2, 3]], "a single row")
    yield _case([[1], [2], [3]], "a single column")
    yield _case(_numbered(2, 2), "two by two")
    yield _case(_numbered(3, 3), "three by three")
    yield _case([[-(10**9), 10**9]], "the extremes of the stated value range")

    for rows, columns in ((1, 9), (9, 1), (2, 7), (7, 2), (4, 6), (6, 4), (5, 5)):
        yield _case(_numbered(rows, columns))

    for _ in range(3):
        rows = rng.randint(1, 15)
        columns = rng.randint(1, 15)
        yield _case([[rng.randint(-(10**9), 10**9) for _ in range(columns)] for _ in range(rows)])

    yield _case(_numbered(100, 100), "the stated maximum")
    yield _case(_numbered(1, 100), "the stated maximum, one row deep")
    yield _case(_numbered(100, 1), "the stated maximum, one column wide")
