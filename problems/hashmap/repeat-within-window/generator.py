"""Random inputs for repeat-within-window.

Random values over a wide range almost never repeat, so the cases that can
answer `true` draw from a small pool. The shapes that matter: k = 0, a repeat
exactly k apart, a repeat one further than k, and no repeat at all.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], k: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values, k]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([7], 5, "a single reading cannot repeat")
    yield _case([7, 7], 0, "k = 0 never counts")
    yield _case([7, 7], 1, "adjacent equals, exactly in reach")
    yield _case([1, 2, 1], 1, "a repeat one step out of reach")
    yield _case([1, 2, 1], 2, "the same repeat, just in reach")
    yield _case([-(10**9), 10**9, -(10**9)], 2, "the extremes of the stated range")

    for n, pool, k in ((6, 4, 2), (25, 8, 3), (60, 60, 10), (150, 20, 1)):
        yield _case([rng.randint(0, pool) for _ in range(n)], k)

    # All distinct, so the answer is `false` however large k is.
    yield _case(rng.sample(range(10**6), 400), 10**4, "every reading distinct")

    for _ in range(2):
        n = rng.randint(300, 900)
        yield _case([rng.randint(0, n // 3) for _ in range(n)], rng.randint(1, 50))

    # The stated maxima, where comparing every pair within reach cannot finish.
    n = 10**4
    values = rng.sample(range(10**7), n)
    yield _case(values, 10**4, "the stated maximum, all distinct, with k at its maximum")
