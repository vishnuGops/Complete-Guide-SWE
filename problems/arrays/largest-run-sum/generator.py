"""Random inputs for largest-run-sum.

The shapes that separate a correct answer from a plausible one: all negative
(the empty run must not be allowed), all positive (the whole row), a single
element, and a long row where the best run sits in the middle.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([-5], "a single negative value")
    yield _case([0], "a single zero")
    yield _case([-1, -2, -3], "every value negative")
    yield _case([1, 2, 3], "every value positive")
    yield _case([5, -10, 5], "two equal runs either side of a big loss")
    yield _case([10**4, -(10**4), 10**4], "the extremes of the stated range")

    for n in (2, 8, 40, 150):
        yield _case([rng.randint(-50, 50) for _ in range(n)])

    for _ in range(3):
        n = rng.randint(200, 900)
        yield _case([rng.randint(-(10**4), 10**4) for _ in range(n)])

    # The stated maximum, biased negative so the answer is a genuine run rather
    # than the whole row - and so that the quadratic scan the editorial warns
    # about has to do all hundred million additions (D21).
    n = 10**4
    values = [rng.randint(-(10**4), 2000) for _ in range(n)]
    values[n // 2] = 10**4
    yield _case(values, "the stated maximum")
