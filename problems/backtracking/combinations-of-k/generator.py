"""Random inputs for combinations-of-k.

Both ends of `k` are covered at every size, because k = 0 and k = n are where the
base case and the pruning bound are tested.
"""

import random
from typing import Any, Dict, Iterator


def _case(n: int, k: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [n, k]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(1, 0, "one number, choosing nothing")
    yield _case(1, 1, "one number, choosing it")
    yield _case(3, 0, "choosing nothing")
    yield _case(3, 3, "choosing everything")
    yield _case(4, 2, "two from four")
    yield _case(5, 1, "one from five")
    yield _case(5, 4, "four from five")

    for n in (2, 3, 6, 8, 10):
        for k in (0, 1, n // 2, n - 1, n):
            yield _case(n, max(0, k))

    yield _case(12, 6, "the middle of twelve")
    yield _case(14, 2, "the stated maximum, choosing two")
    yield _case(14, 13, "the stated maximum, choosing all but one")
    yield _case(14, 7, "the stated maximum, at its widest")
