"""Random inputs for largest-rectangle.

The shapes that matter: strictly increasing (nothing is settled until the
sentinel), strictly decreasing (everything is settled immediately), all equal,
zeroes scattered through, and a maximum-size row where trying every span cannot
finish.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(heights: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [heights]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([5], "a single column")
    yield _case([0], "a single column of no height")
    yield _case([0, 0, 0], "no height anywhere")
    yield _case([1, 2, 3, 4], "strictly increasing, so only the sentinel settles it")
    yield _case([4, 3, 2, 1], "strictly decreasing")
    yield _case([2, 2, 2], "every column the same")
    yield _case([4, 2, 7, 8, 1, 5], "two tall neighbours between shorter columns")
    yield _case([10**4, 10**4], "the extremes of the stated height range")
    yield _case([3, 0, 3], "a zero splitting the row in two")

    for n, high in ((5, 6), (20, 10), (80, 40), (300, 5)):
        yield _case([rng.randint(0, high) for _ in range(n)])

    for _ in range(2):
        n = rng.randint(500, 2000)
        yield _case([rng.randint(0, 10**4) for _ in range(n)])

    n = 10**4
    yield _case(list(range(1, n + 1)), "the stated maximum, strictly increasing")
    yield _case(
        [rng.randint(0, 10**4) for _ in range(n)],
        "the stated maximum, at random",
    )
