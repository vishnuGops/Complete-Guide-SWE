"""Random inputs for last-stone-standing.

Piles of equal or near-equal weights are over-represented, because that is where
stones destroy each other and the pile empties - the case a solution that assumes
something is always left gets wrong.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(stones: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [stones]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([5], "a single stone")
    yield _case([1, 1], "two equal stones")
    yield _case([2, 1], "two unequal stones")
    yield _case([5, 11, 3, 8, 2, 6], "a pile of six")
    yield _case([1000, 1000], "the extremes of the stated range, equal")
    yield _case([1000, 1], "the extremes, unequal")
    yield _case([3, 3, 3, 3], "four equal stones, all destroyed")
    yield _case([3, 3, 3], "three equal stones")

    for n, high in ((3, 5), (8, 10), (30, 50), (150, 1000)):
        yield _case([rng.randint(1, high) for _ in range(n)])
        yield _case([rng.choice([7, 8]) for _ in range(n)])

    yield _case([1] * 999, "a thousand stones of weight one, an odd number")
    yield _case([1] * 1000, "a thousand stones of weight one, an even number")

    for _ in range(2):
        n = rng.randint(1000, 4000)
        yield _case([rng.randint(1, 1000) for _ in range(n)])

    yield _case([rng.randint(1, 1000) for _ in range(10**4)], "the stated maximum")
