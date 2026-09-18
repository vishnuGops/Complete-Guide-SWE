"""Random inputs for best-single-trade.

Three shapes decide whether a solution is right: monotone falling (the answer is
zero), monotone rising (the answer is the whole range), and a late dip followed
by a late peak, which is what catches "the maximum minus the minimum".
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([5], "one day, so no trade is possible")
    yield _case([3, 3, 3], "a flat market")
    yield _case([1, 2, 3, 4], "rising every day")
    yield _case([4, 3, 2, 1], "falling every day")
    yield _case([9, 1, 2], "the peak comes before the dip")
    yield _case([0, 10**9], "the extremes of the stated range")

    for n in (2, 6, 25, 90):
        yield _case([rng.randint(0, 1000) for _ in range(n)])

    for _ in range(3):
        n = rng.randint(200, 800)
        yield _case([rng.randint(0, 10**9) for _ in range(n)])

    # A late dip and a later peak, at the stated maximum: the shape where
    # "largest minus smallest" gives the wrong answer.
    n = 10**4
    values = [rng.randint(10**8, 10**9) for _ in range(n)]
    values[n - 3] = 0
    values[n - 1] = 10**9
    yield _case(values, "the stated maximum, with the dip near the end")
