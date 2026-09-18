"""Random inputs for zero-sum-stretch.

Cancelling stretches are rare in a uniformly random row, so most cases are built
to contain them: small values around zero, runs of zeroes, and mirrored pairs.
The maximum case is all zeroes, which is both the largest possible answer and
the shape a quadratic scan cannot finish.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([0], "a single zero is itself a cancelling stretch")
    yield _case([5], "a single non-zero value is not")
    yield _case([1, -1], "the smallest cancelling pair")
    yield _case([10**4, -(10**4)], "the extremes of the stated range")
    yield _case([1, 2, 3, 4], "nothing cancels")
    yield _case([0, 0, 0, 0], "four zeroes, so ten stretches")

    for n, spread in ((5, 2), (16, 3), (40, 5), (120, 2)):
        yield _case([rng.randint(-spread, spread) for _ in range(n)])

    # A row whose running total returns to a handful of values often.
    yield _case([rng.choice([-1, 0, 1]) for _ in range(600)], "a walk that keeps returning")

    for _ in range(2):
        n = rng.randint(300, 800)
        yield _case([rng.randint(-(10**4), 10**4) for _ in range(n)])

    yield _case([0] * (10**4), "the stated maximum, all zeroes: the largest possible answer")
