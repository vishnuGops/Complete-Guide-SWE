"""Random inputs for zero-the-cross.

Zeroes are placed deliberately rather than at random: in the first row, in the
first column, at the corner where the two markers collide, and scattered through
the interior. A grid whose zeroes are all in row 0 or column 0 is what catches a
solution that blanks its own markers too early.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(grid: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [grid]}
    if name:
        case["name"] = name
    return case


def _grid(rng: random.Random, rows: int, columns: int, zeroes: int) -> List[List[int]]:
    out = [[rng.randint(1, 50) for _ in range(columns)] for _ in range(rows)]
    for _ in range(zeroes):
        out[rng.randrange(rows)][rng.randrange(columns)] = 0
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[0]], "one cell, already zero")
    yield _case([[5]], "one cell, not zero")
    yield _case([[1, 2], [3, 4]], "no zeroes at all")
    yield _case([[0, 1], [1, 1]], "a zero at the marker corner")
    yield _case([[1, 0], [1, 1]], "a zero in the first row only")
    yield _case([[1, 1], [0, 1]], "a zero in the first column only")
    yield _case([[1, 1, 1], [1, 0, 1], [1, 1, 1]], "one zero in the middle")
    yield _case([[0, 0], [0, 0]], "every cell zero")
    yield _case([[-(10**9), 0], [10**9, 1]], "the extremes of the stated range")

    for rows, columns, zeroes in ((1, 6, 1), (6, 1, 1), (3, 4, 2), (5, 5, 3), (8, 6, 6)):
        yield _case(_grid(rng, rows, columns, zeroes))

    # Zeroes confined to the first row and column, where the markers live.
    edge = _grid(rng, 6, 6, 0)
    edge[0][3] = 0
    edge[4][0] = 0
    yield _case(edge, "zeroes only where the markers are stored")

    for _ in range(2):
        rows = rng.randint(10, 40)
        columns = rng.randint(10, 40)
        yield _case(_grid(rng, rows, columns, rng.randint(1, 5)))

    yield _case(_grid(rng, 100, 100, 6), "the stated maximum")
    yield _case(_grid(rng, 1, 100, 1), "the stated maximum, one row deep")
