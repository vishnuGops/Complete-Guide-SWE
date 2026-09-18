"""Random inputs for all-permutations.

The answer is n! lists, so seven is the ceiling and most cases are much smaller.
Values are sampled without replacement, as the statement requires.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([0], "one value")
    yield _case([5, 9], "two values")
    yield _case([1, 2, 3], "three values")
    yield _case([-(10**9), 10**9], "the extremes of the stated range")
    yield _case([3, 1, 2], "already out of order")

    for n in (2, 3, 4, 5):
        yield _case(rng.sample(range(-50, 50), n))
        yield _case(rng.sample(range(-(10**9), 10**9), n))

    yield _case(list(range(6)), "six values in order")
    yield _case(rng.sample(range(-(10**9), 10**9), 6), "six values")
    yield _case(list(range(7)), "the stated maximum, in order")
    yield _case(rng.sample(range(-(10**9), 10**9), 7), "the stated maximum")
