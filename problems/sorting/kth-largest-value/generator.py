"""Random inputs for kth-largest-value.

The shapes that matter: k = 1 and k = n (the extremes of the heap's size), rows
of a single repeated value, and a maximum-size row with k near n / 2, which is
where taking the maximum k times cannot finish.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], k: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values, k]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([7], 1, "a single reading")
    yield _case([1, 2, 3, 4], 1, "k = 1 is the maximum")
    yield _case([1, 2, 3, 4], 4, "k = n is the minimum")
    yield _case([5, 5, 5, 5], 3, "every reading the same")
    yield _case([-(10**9), 10**9], 2, "the extremes of the stated range")
    yield _case([2, 1], 1, "the row is out of order")

    for n in (5, 18, 60, 200):
        values = [rng.randint(-1000, 1000) for _ in range(n)]
        yield _case(values, rng.randint(1, n))

    # Heavy duplicates, so a solution that de-duplicates gives a wrong answer.
    yield _case([rng.randint(0, 4) for _ in range(500)], 250, "five distinct values across five hundred readings")

    for _ in range(2):
        n = rng.randint(1000, 4000)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)], rng.randint(1, n))

    n = 10**5
    yield _case(
        [rng.randint(-(10**9), 10**9) for _ in range(n)],
        n // 2,
        "the stated maximum with k near n / 2",
    )
