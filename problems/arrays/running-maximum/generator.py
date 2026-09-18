"""Random inputs for running-maximum.

The shapes that matter are the ones where the running value does something
different: already sorted (it rises every step), reverse sorted (it never moves
after the first), all equal, and a single element.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([0], "a single zero")
    yield _case([5, 5, 5, 5], "every reading equal")
    yield _case([1, 2, 3, 4, 5], "already rising, so it moves every step")
    yield _case([5, 4, 3, 2, 1], "falling, so it never moves after the first")
    yield _case([-(10**9), 10**9], "the extremes of the stated range")
    yield _case([10**9, -(10**9)], "the largest value arrives first")

    for n in (2, 7, 30, 120):
        yield _case([rng.randint(-1000, 1000) for _ in range(n)])

    for _ in range(3):
        n = rng.randint(200, 900)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)])

    # The stated maximum (D21). Nothing here is quadratic, but a constraint that
    # is never reached is a constraint nobody has tested.
    yield _case(
        [rng.randint(-(10**9), 10**9) for _ in range(10**4)],
        "a large row at the stated value range",
    )
