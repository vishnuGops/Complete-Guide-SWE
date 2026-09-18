"""Random inputs for drop-nth-from-end.

The two ends of `n` are what matter: n = 1 removes the tail, n = length removes
the head, and the head case is the one that fails without a dummy link.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], n: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values, n]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], 1, "the only link")
    yield _case([1, 2], 1, "the tail of two")
    yield _case([1, 2], 2, "the head of two")
    yield _case([1, 2, 3, 4, 5], 5, "the head of five")
    yield _case([7, 7, 7, 7], 2, "every value the same")
    yield _case([-(10**9), 10**9], 1, "the extremes of the stated range")

    for length in (3, 9, 40, 200):
        values = [rng.randint(-1000, 1000) for _ in range(length)]
        yield _case(list(values), rng.randint(1, length))
        yield _case(list(values), 1)
        yield _case(list(values), length)

    for _ in range(2):
        length = rng.randint(500, 2000)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(length)], rng.randint(1, length))

    length = 10**4
    yield _case(
        [rng.randint(-(10**9), 10**9) for _ in range(length)],
        length,
        "the stated maximum, removing the head",
    )
