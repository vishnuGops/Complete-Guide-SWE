"""Random inputs for all-subsets.

The answer is 2^n lists, so the sizes stay small on purpose. Duplicates are not
allowed by the statement, so every row is sampled without replacement.
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
    yield _case([7, -7], "a negative value")
    yield _case([1, 2, 3], "three values")
    yield _case([-(10**9), 10**9], "the extremes of the stated range")

    for n in (2, 4, 5, 6, 7, 8):
        yield _case(rng.sample(range(-100, 100), n))
        yield _case(rng.sample(range(-(10**9), 10**9), n))

    yield _case(list(range(10)), "ten values in order")
    yield _case(rng.sample(range(-(10**9), 10**9), 11), "eleven values")
    yield _case(rng.sample(range(-(10**9), 10**9), 12), "the stated maximum")
