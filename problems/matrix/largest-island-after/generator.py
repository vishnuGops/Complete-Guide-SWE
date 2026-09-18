"""Random inputs for largest-island-after.

Drawn at several land densities: sparse maps make filling join little, dense
ones make one fill complete a very large island, and the middle range produces
the U shapes where one island touches a water cell more than once. Both
degenerate maps - all land and all water - are included.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(terrain: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [terrain]}
    if name:
        case["name"] = name
    return case


def _map(rng: random.Random, rows: int, columns: int, density: float) -> List[List[int]]:
    return [[1 if rng.random() < density else 0 for _ in range(columns)] for _ in range(rows)]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[0]], "one cell of water")
    yield _case([[1]], "one cell of land")
    yield _case([[1, 0], [0, 1]], "two islands joined by one cell")
    yield _case([[1, 1], [1, 0]], "completing a square")
    yield _case([[1, 1], [1, 1]], "nothing to fill")
    yield _case([[0, 0], [0, 0]], "all water, so the answer is one")
    yield _case([[1, 1, 1], [1, 0, 1], [1, 1, 1]], "one island wrapped around a single gap")
    yield _case([[1, 0, 1], [1, 0, 1], [1, 1, 1]], "a U shape touching a gap twice")

    for rows, columns, density in ((3, 3, 0.5), (4, 6, 0.4), (6, 6, 0.6), (10, 10, 0.3), (12, 9, 0.55)):
        yield _case(_map(rng, rows, columns, density))
        yield _case(_map(rng, rows, columns, density))

    for _ in range(2):
        size = rng.randint(20, 50)
        yield _case(_map(rng, size, size, rng.choice([0.3, 0.55, 0.8])))

    yield _case([[1] * 100 for _ in range(100)], "the stated maximum, entirely land")
    yield _case([[0] * 100 for _ in range(100)], "the stated maximum, entirely water")
    yield _case(
        _map(rng, 100, 100, 0.6),
        "the stated maximum, where filling and re-measuring cannot finish",
    )
