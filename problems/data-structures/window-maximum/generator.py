"""Random inputs for window-maximum.

Rows that are already decreasing keep every reading a candidate and make the
deque as long as the window; rows that are increasing empty it every step. Both
are generated, along with heavy duplicates and the maximum size with k near
n / 2, where scanning each window cannot finish.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(readings: List[int], k: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [readings, k]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([9], 1, "a window of one")
    yield _case([1, 3, -1, -3, 5, 3, 6, 7], 3, "a window of three")
    yield _case([7, 7, 7], 2, "every reading equal")
    yield _case([1, 2, 3, 4, 5], 5, "one window, the whole row")
    yield _case([5, 4, 3, 2, 1], 2, "strictly decreasing")
    yield _case([1, 2, 3, 4, 5], 2, "strictly increasing")
    yield _case([-(10**9), 10**9], 2, "the extremes of the stated range")

    for n, k, pool in ((6, 3, 10), (20, 5, 20), (60, 30, 5), (200, 7, 1000)):
        yield _case([rng.randint(-pool, pool) for _ in range(n)], k)

    yield _case(list(range(500, 0, -1)), 100, "five hundred decreasing, window of a hundred")
    yield _case([rng.randint(0, 3) for _ in range(500)], 50, "four distinct values")

    for _ in range(2):
        n = rng.randint(1500, 3000)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)], rng.randint(1, 200))

    # One case at the stated maximum, not two: a second would push tests.json
    # past the size the validator allows for a reviewable diff.
    n = 10**5
    yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)], n // 2,
                "the stated maximum with k near n / 2, where scanning cannot finish")
