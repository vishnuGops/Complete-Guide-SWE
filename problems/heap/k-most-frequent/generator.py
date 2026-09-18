"""Random inputs for k-most-frequent.

Values are drawn from small pools so that ties in frequency happen constantly -
the tie rule is what most solutions get wrong, and a wide pool would almost
never exercise it.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(readings: List[int], k: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [readings, k]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([7], 1, "a single reading")
    yield _case([1, 1, 1, 2, 2, 3], 2, "clear winners")
    yield _case([5, 5, 4, 4, 3], 2, "a tie broken by value")
    yield _case([1, 2, 3, 4], 4, "every value once, so the order is by value")
    yield _case([1, 2, 3, 4], 2, "every value once, taking only two")
    yield _case([-(10**9), 10**9], 2, "the extremes of the stated range")
    yield _case([-1, -1, -2, -2], 2, "negative values, tied")

    for n, pool in ((6, 3), (20, 5), (80, 8), (300, 12)):
        readings = [rng.randint(-pool, pool) for _ in range(n)]
        distinct = len(set(readings))
        yield _case(readings, rng.randint(1, distinct))
        yield _case(readings, 1)
        yield _case(readings, distinct)

    # Everything tied, so the whole answer is decided by the tie rule.
    yield _case([value for value in range(200) for _ in range(3)], 5, "every value equally common")

    for _ in range(2):
        n = rng.randint(1000, 5000)
        readings = [rng.randint(-50, 50) for _ in range(n)]
        yield _case(readings, rng.randint(1, len(set(readings))))

    n = 10**5
    readings = [rng.randint(-(10**9), 10**9) for _ in range(n)]
    yield _case(readings, 10, "the stated maximum, almost all distinct")
    readings = [rng.randint(0, 300) for _ in range(n)]
    yield _case(readings, 50, "the stated maximum over a small pool")
