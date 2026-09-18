"""Random inputs for shortest-grid-path.

Random walls at a high density usually block the route entirely, so the plans
are drawn at several densities and both answers occur often. Mazes with a single
winding corridor are included because that is where a depth-first search gives a
plausible but wrong number.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(plan: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [plan]}
    if name:
        case["name"] = name
    return case


def _plan(rng: random.Random, rows: int, columns: int, wall: float) -> List[List[int]]:
    out = [[1 if rng.random() < wall else 0 for _ in range(columns)] for _ in range(rows)]
    out[0][0] = 0
    out[rows - 1][columns - 1] = 0
    return out


def _corridor(rows: int, columns: int) -> List[List[int]]:
    """A snake: every odd row is a wall with a single gap, at alternating ends,
    so the only route runs the full width of every even row in turn."""
    out = [[0] * columns for _ in range(rows)]
    for row in range(1, rows, 2):
        for column in range(columns):
            out[row][column] = 1
        out[row][columns - 1 if (row // 2) % 2 == 0 else 0] = 0
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[0]], "a single open cell")
    yield _case([[1]], "a single blocked cell")
    yield _case([[0, 1], [1, 0]], "no route, only a diagonal touch")
    yield _case([[0, 0], [0, 0]], "two by two, wide open")
    yield _case([[0, 0, 0], [1, 1, 0], [0, 0, 0]], "around a wall")
    yield _case([[0] * 8], "a single open row")
    yield _case([[0] for _ in range(8)], "a single open column")

    for rows, columns, wall in ((3, 3, 0.2), (5, 5, 0.3), (8, 6, 0.35), (12, 12, 0.25), (10, 10, 0.5)):
        yield _case(_plan(rng, rows, columns, wall))
        yield _case(_plan(rng, rows, columns, wall))

    yield _case(_corridor(9, 9), "a snaking corridor, where a depth-first route is far too long")

    for _ in range(2):
        size = rng.randint(30, 60)
        yield _case(_plan(rng, size, size, rng.choice([0.15, 0.3])))

    yield _case([[0] * 100 for _ in range(100)], "the stated maximum, wide open")
    yield _case(_corridor(99, 99), "the stated maximum as a snaking corridor")
    yield _case(_plan(rng, 100, 100, 0.3), "the stated maximum at a middling wall density")
