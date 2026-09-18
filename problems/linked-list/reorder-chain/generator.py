"""Random inputs for reorder-chain.

Both parities at every small length, because where the middle link ends up is
decided by the cut and is only visible on odd chains.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], "the empty chain")
    yield _case([1], "a single link")
    yield _case([1, 2], "two links")
    yield _case([1, 2, 3], "three links")
    yield _case([1, 2, 3, 4], "four links")
    yield _case([7, 7, 7, 7, 7], "every value the same")
    yield _case([-(10**9), 10**9], "the extremes of the stated range")

    for n in (5, 6, 15, 16, 99, 100):
        yield _case([rng.randint(-1000, 1000) for _ in range(n)])

    for _ in range(2):
        n = rng.randint(500, 2000)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)])

    yield _case([rng.randint(-(10**9), 10**9) for _ in range(10**4)], "the stated maximum")
    yield _case([rng.randint(-(10**9), 10**9) for _ in range(10**4 - 1)], "the stated maximum, odd")
