"""Random inputs for rotting-spread.

Crates are drawn with a few spoiled cells and many fresh ones, at several empty-
cell densities, so that both a finite answer and -1 occur often. The single-
source and no-source cases are included explicitly, since they are where the
minute count is usually one too many or the -1 is missed.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(crate: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [crate]}
    if name:
        case["name"] = name
    return case


def _crate(rng: random.Random, rows: int, columns: int, empty: float, spoiled: int) -> List[List[int]]:
    out = [[0 if rng.random() < empty else 1 for _ in range(columns)] for _ in range(rows)]
    for _ in range(spoiled):
        out[rng.randrange(rows)][rng.randrange(columns)] = 2
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[0]], "one empty cell")
    yield _case([[1]], "one fresh cell and nothing to spoil it")
    yield _case([[2]], "one spoiled cell")
    yield _case([[0, 2]], "nothing fresh")
    yield _case([[2, 1, 1], [1, 1, 0], [0, 1, 1]], "the whole crate spoils")
    yield _case([[2, 1, 1], [0, 1, 1], [1, 0, 1]], "one cell cut off")
    yield _case([[2, 1, 1, 1, 1]], "a single row spreading in one direction")
    yield _case([[1, 1, 2, 1, 1]], "a single row spreading both ways")
    yield _case([[2] + [1] * 9, [2] + [1] * 9], "two sources spreading together")

    for rows, columns, empty, spoiled in (
        (3, 3, 0.1, 1),
        (4, 5, 0.3, 2),
        (6, 6, 0.2, 1),
        (8, 8, 0.4, 3),
        (10, 10, 0.05, 1),
    ):
        yield _case(_crate(rng, rows, columns, empty, spoiled))
        yield _case(_crate(rng, rows, columns, empty, spoiled))

    for _ in range(2):
        size = rng.randint(20, 50)
        yield _case(_crate(rng, size, size, rng.choice([0.1, 0.3]), rng.randint(1, 4)))

    yield _case([[1] * 100 for _ in range(99)] + [[2] + [1] * 99],
                "the stated maximum, one source in the corner")
    yield _case(_crate(rng, 100, 100, 0.2, 5), "the stated maximum with several sources")
