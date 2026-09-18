"""Random inputs for house-robber.

Rows that punish the two obvious wrong answers are generated deliberately: a
large house between two small ones (greedy fails), and a row where the best set
skips two houses in a row (alternating fails).
"""

import random
from typing import Any, Dict, Iterator, List


def _case(houses: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [houses]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([5], "one house")
    yield _case([0], "one empty house")
    yield _case([1, 2], "two houses")
    yield _case([1, 2, 3, 1], "four houses")
    yield _case([2, 7, 9, 3, 1], "five houses")
    yield _case([5, 1, 1, 5], "the best set skips two in a row")
    yield _case([400, 400], "the extremes of the stated range")
    yield _case([0, 0, 0, 0], "every house empty")
    yield _case([1, 400, 1, 1, 400, 1], "two large houses among small ones")

    for n in (3, 6, 15, 60, 300):
        yield _case([rng.randint(0, 400) for _ in range(n)])
        yield _case([rng.choice([0, 400]) for _ in range(n)])

    for _ in range(2):
        n = rng.randint(1000, 5000)
        yield _case([rng.randint(0, 400) for _ in range(n)])

    yield _case([rng.randint(0, 400) for _ in range(10**4)], "the stated maximum")
    yield _case([400] * (10**4), "the stated maximum, every house full")
