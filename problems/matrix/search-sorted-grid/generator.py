"""Random inputs for search-sorted-grid.

Grids are built by drawing distinct values, sorting them and cutting them into
rows, which is exactly the stated shape. Targets are drawn half from the grid
and half from the gaps between its values, including below the smallest and
above the largest.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(grid: List[List[int]], target: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [grid, target]}
    if name:
        case["name"] = name
    return case


def _grid(rng: random.Random, rows: int, columns: int, spread: int) -> List[List[int]]:
    values = sorted(rng.sample(range(-spread, spread), rows * columns))
    return [values[row * columns:(row + 1) * columns] for row in range(rows)]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[1]], 1, "a single cell, present")
    yield _case([[1]], 2, "a single cell, absent")
    yield _case([[1, 3, 5], [7, 9, 11]], 6, "absent, between two rows")
    yield _case([[1, 3, 5], [7, 9, 11]], 1, "the first cell")
    yield _case([[1, 3, 5], [7, 9, 11]], 11, "the last cell")
    yield _case([[-(10**9), 10**9]], -(10**9), "the extremes of the stated range")

    for rows, columns in ((1, 8), (8, 1), (3, 4), (6, 7), (12, 12)):
        grid = _grid(rng, rows, columns, 10**4)
        flat = [value for row in grid for value in row]
        yield _case(grid, rng.choice(flat))
        yield _case(grid, rng.randint(-(10**4), 10**4))
        yield _case(grid, flat[-1] + 1)
        yield _case(grid, flat[0] - 1)

    grid = _grid(rng, 100, 100, 10**9)
    flat = [value for row in grid for value in row]
    yield _case(grid, flat[len(flat) // 3], "the stated maximum, present")
    yield _case(grid, flat[0] - 1, "the stated maximum, absent")
