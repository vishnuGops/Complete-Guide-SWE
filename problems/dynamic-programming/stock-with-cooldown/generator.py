"""Random inputs for stock-with-cooldown.

Prices that rise and fall every other day are generated deliberately: that is the
shape where taking every rise is wrong, because each sale costs the next day.
Monotone runs bracket the answer at zero and at the whole range.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(prices: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [prices]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], "one day")
    yield _case([1, 2], "two days")
    yield _case([2, 1], "two days, falling")
    yield _case([3, 5, 1, 4, 2, 6], "two trades around a cooldown")
    yield _case([5, 4, 3], "prices only fall")
    yield _case([1, 2, 3, 4, 5], "prices only rise")
    yield _case([0, 1000], "the extremes of the stated range")
    yield _case([1, 2, 1, 2, 1, 2], "alternating, where every rise cannot be taken")
    yield _case([7, 7, 7, 7], "every price the same")

    for n, high in ((3, 5), (8, 10), (25, 50), (120, 1000), (400, 8)):
        yield _case([rng.randint(0, high) for _ in range(n)])
        yield _case([rng.choice([0, high]) for _ in range(n)])

    for _ in range(2):
        n = rng.randint(1000, 3000)
        yield _case([rng.randint(0, 1000) for _ in range(n)])

    yield _case([rng.randint(0, 1000) for _ in range(5000)], "the stated maximum")
    yield _case([i % 2 * 1000 for i in range(5000)], "the stated maximum, alternating extremes")
