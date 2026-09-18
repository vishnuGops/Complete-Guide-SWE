"""Random inputs for burst-the-balloons.

Zeroes are included on purpose - a zero scores nothing wherever it is burst, but
it still separates its neighbours - and rows of equal values give a known shape.
The stated maximum is three hundred, where the cubic table is about nine million
updates.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(balloons: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [balloons]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([7], "one balloon")
    yield _case([0], "one balloon worth nothing")
    yield _case([1, 5], "two balloons")
    yield _case([3, 1, 5, 8], "four balloons")
    yield _case([100, 100], "the extremes of the stated range")
    yield _case([0, 0, 0], "every balloon worth nothing")
    yield _case([5, 0, 5], "a zero between two others")
    yield _case([1, 1, 1, 1, 1], "every balloon the same")

    for n, high in ((3, 10), (6, 20), (12, 100), (30, 5), (60, 100)):
        yield _case([rng.randint(0, high) for _ in range(n)])

    yield _case(list(range(1, 21)), "twenty, rising")
    yield _case([rng.randint(0, 100) for _ in range(120)], "one hundred and twenty")

    yield _case([rng.randint(0, 100) for _ in range(300)], "the stated maximum")
    yield _case([100] * 300, "the stated maximum, every balloon at the top of the range")
