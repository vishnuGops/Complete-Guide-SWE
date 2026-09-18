"""Random inputs for count-islands.

Maps are drawn at several land densities: sparse ones give many single-cell
islands, dense ones give one large island, and the middle range gives the
ragged shapes where a diagonal join would be miscounted. A full grid at the
stated maximum is included because that is where a recursive fill runs out of
stack.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(grid: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [grid]}
    if name:
        case["name"] = name
    return case


def _map(rng: random.Random, rows: int, columns: int, density: float) -> List[List[int]]:
    return [[1 if rng.random() < density else 0 for _ in range(columns)] for _ in range(rows)]


def _checkerboard(rows: int, columns: int) -> List[List[int]]:
    return [[(row + column) % 2 for column in range(columns)] for row in range(rows)]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[0]], "one cell of water")
    yield _case([[1]], "one cell of land")
    yield _case([[0, 0], [0, 0]], "all water")
    yield _case([[1, 1], [1, 1]], "all land")
    yield _case([[1, 1, 0], [0, 1, 0], [0, 0, 1]], "two islands touching at a corner")
    yield _case([[1, 0], [0, 1]], "a diagonal pair is two islands")
    yield _case(_checkerboard(5, 5), "a checkerboard, every land cell its own island")

    for rows, columns, density in ((1, 8, 0.5), (8, 1, 0.5), (4, 6, 0.3), (6, 6, 0.6), (10, 12, 0.45)):
        yield _case(_map(rng, rows, columns, density))

    for _ in range(2):
        rows = rng.randint(20, 50)
        columns = rng.randint(20, 50)
        yield _case(_map(rng, rows, columns, rng.choice([0.2, 0.5, 0.8])))

    yield _case([[1] * 100 for _ in range(100)], "the stated maximum, entirely land")
    yield _case(_checkerboard(100, 100), "the stated maximum as a checkerboard")
    yield _case(_map(rng, 100, 100, 0.55), "the stated maximum at a ragged density")
