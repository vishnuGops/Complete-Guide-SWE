"""Random inputs for rotate-grid.

Grids are numbered by position in most cases, so that a turn that does nothing -
the classic double-transpose bug - is visible rather than accidental. Both
parities of size are covered, since an odd grid has a fixed centre cell.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(grid: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [grid]}
    if name:
        case["name"] = name
    return case


def _numbered(n: int) -> List[List[int]]:
    return [[row * n + column for column in range(n)] for row in range(n)]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([[5]], "one cell")
    yield _case(_numbered(2), "two by two")
    yield _case(_numbered(3), "three by three, with a fixed centre")
    yield _case(_numbered(4), "four by four")
    yield _case([[7, 7], [7, 7]], "every cell the same, where a turn is invisible")
    yield _case([[-(10**9), 10**9], [10**9, -(10**9)]], "the extremes of the stated range")

    for n in (5, 6, 9, 20):
        yield _case(_numbered(n))
        yield _case([[rng.randint(-1000, 1000) for _ in range(n)] for _ in range(n)])

    for _ in range(2):
        n = rng.randint(30, 60)
        yield _case([[rng.randint(-(10**9), 10**9) for _ in range(n)] for _ in range(n)])

    yield _case(_numbered(100), "the stated maximum")
    yield _case(_numbered(99), "the stated maximum, odd, with a fixed centre")
