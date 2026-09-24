"""Random inputs for longest-rising-run.

Ties are over-represented, because the strictly-increasing rule is what a
non-strict search gets wrong, and the monotone rows bracket the answer at 1 and
at n.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(readings: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [readings]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], "one reading")
    yield _case([7, 7, 7], "every reading equal")
    yield _case([5, 4, 3, 2, 1], "only falling")
    yield _case([1, 2, 3, 4, 5], "only rising")
    yield _case([4, 11, 5, 6, 0, 13, 7, 2], "a run of four")
    yield _case([-(10**9), 10**9], "the extremes of the stated range")
    yield _case([1, 1, 2, 2, 3, 3], "every value twice")

    for n, pool in ((4, 3), (12, 5), (50, 10), (200, 40), (800, 800)):
        yield _case([rng.randint(-pool, pool) for _ in range(n)])

    yield _case(list(range(500)), "five hundred, strictly rising")
    yield _case(list(range(500, 0, -1)), "five hundred, strictly falling")

    for _ in range(2):
        n = rng.randint(2000, 8000)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)])

    n = 10**5
    yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)],
                "the stated maximum, where the quadratic table cannot finish")
    yield _case([rng.randint(0, 20) for _ in range(n)],
                "the stated maximum with heavy ties")
