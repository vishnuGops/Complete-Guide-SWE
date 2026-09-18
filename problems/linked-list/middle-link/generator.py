"""Random inputs for middle-link.

Both parities at every small length, because which middle you land on is decided
entirely by the loop condition and only visible on even chains.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([9], "one link")
    yield _case([1, 2], "two links, so the second is the middle")
    yield _case([1, 2, 3], "three links")
    yield _case([1, 2, 3, 4], "four links")
    yield _case([5, 5, 5, 5, 5], "every value the same")
    yield _case([-(10**9), 10**9], "the extremes of the stated range")

    for n in (5, 6, 17, 18, 99, 100):
        yield _case([rng.randint(-1000, 1000) for _ in range(n)])

    for _ in range(2):
        n = rng.randint(500, 2000)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)])

    yield _case([rng.randint(-(10**9), 10**9) for _ in range(10**4)], "the stated maximum")
