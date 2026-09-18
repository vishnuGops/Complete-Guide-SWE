"""Random inputs for grid-paths.

Blocked cells are placed at several densities, and the start and finish are
blocked explicitly in two cases because both give zero and both are easy to
forget. Wide and tall grids are covered separately, since the two dimensions are
not interchangeable in the table's indexing.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(grid: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [grid]}
    if name:
        case["name"] = name
    return case


def _grid(rng: random.Random, rows: int, columns: int, blocked: float) -> List[List[int]]:
    out = [[1 if rng.random() < blocked else 0 for _ in range(columns)] for _ in range(rows)]
    out[0][0] = 0
    out[rows - 1][columns - 1] = 0
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[0]], "a single open cell")
    yield _case([[1]], "the start is blocked")
    yield _case([[0, 1], [0, 0]], "one route")
    yield _case([[0, 0, 0], [0, 1, 0], [0, 0, 0]], "around a blocked middle")
    yield _case([[0, 0], [1, 0]], "a block below the start")
    yield _case([[0, 0], [0, 1]], "the finish is blocked")
    yield _case([[0] * 8], "a single open row")
    yield _case([[0] for _ in range(8)], "a single open column")
    yield _case([[0, 1, 0], [0, 1, 0], [0, 0, 0]], "a wall with a way round")
    yield _case([[0, 1, 0], [0, 1, 0], [0, 1, 0]], "a wall with no way round")

    for rows, columns, blocked in ((2, 3, 0.0), (4, 4, 0.15), (6, 3, 0.2), (3, 9, 0.2), (8, 8, 0.3)):
        yield _case(_grid(rng, rows, columns, blocked))
        yield _case(_grid(rng, rows, columns, blocked))

    yield _case([[0] * 15 for _ in range(15)], "the stated maximum, wide open")
    yield _case(_grid(rng, 15, 15, 0.15), "the stated maximum with a few blocks")
    yield _case(_grid(rng, 15, 1, 0.2), "the stated maximum, one column wide")
    yield _case(_grid(rng, 1, 15, 0.2), "the stated maximum, one row deep")
