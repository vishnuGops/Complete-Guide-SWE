"""Random inputs for subsets-by-mask.

The answer is 2^n lists, so the sizes stay small. Values are sampled without
replacement, as the statement requires, and several rows are deliberately out of
order - the answer follows the masks, not the values.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([7], "one value")
    yield _case([9, 4], "the order follows the masks")
    yield _case([1, 2, 3], "three values")
    yield _case([-(10**9), 10**9], "the extremes of the stated range")
    yield _case([3, 2, 1], "already out of order")

    for n in (2, 3, 4, 5, 6, 7, 8):
        yield _case(rng.sample(range(-100, 100), n))

    yield _case(list(range(10)), "ten values in order")
    yield _case(rng.sample(range(-(10**9), 10**9), 11), "eleven values")
    yield _case(rng.sample(range(-(10**9), 10**9), 13), "thirteen values")
    yield _case(rng.sample(range(-(10**9), 10**9), 14), "the stated maximum")
