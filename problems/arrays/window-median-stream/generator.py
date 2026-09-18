"""Random inputs for window-median-stream.

The shapes that matter: k = 1 (every reading is its own median), k = n (one
window), even k (the median is an average and may end in .5), heavy duplicates
(lazy deletion has to remove the right copy) and a maximum-size case with k near
n / 2, which is where re-sorting each window cannot finish.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], k: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values, k]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([5], 1, "a single reading")
    yield _case([3, 1, 4, 1, 5], 1, "k = 1, so every reading is its own median")
    yield _case([3, 1, 4, 1, 5], 5, "k = n, so there is one window")
    yield _case([2, 2, 2, 2], 2, "every reading equal")
    yield _case([-(10**9), 10**9], 2, "the extremes, whose sum overflows a 32-bit int")
    yield _case([1, 2, 3, 4, 5, 6], 4, "an even window over rising readings")

    for n, k in ((7, 3), (20, 6), (50, 25), (120, 7)):
        yield _case([rng.randint(-100, 100) for _ in range(n)], k)

    # Heavy duplicates: the reading leaving the window has copies on both sides,
    # so the lazy deletion has to account for exactly one of them.
    yield _case([rng.randint(0, 3) for _ in range(300)], 8, "a handful of distinct values")

    for _ in range(2):
        n = rng.randint(400, 900)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)], rng.randint(2, 60))

    n = 10**4
    yield _case(
        [rng.randint(-(10**9), 10**9) for _ in range(n)],
        n // 2,
        "the stated maximum with k near n / 2, where re-sorting cannot finish",
    )
