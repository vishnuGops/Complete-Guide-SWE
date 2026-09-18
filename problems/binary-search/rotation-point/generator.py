"""Random inputs for rotation-point.

Every row is a rotation of a strictly ascending row of distinct readings. The
rotation amounts that matter are 0 (unrotated, which catches a search that
compares against the left end), 1, n - 1, and everything in between.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def _rotated(rng: random.Random, n: int, by: int, spread: int = 10**9) -> List[int]:
    values = sorted(rng.sample(range(-spread, spread), n))
    return values[by:] + values[:by]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([5], "a single reading")
    yield _case([1, 2, 3], "not rotated")
    yield _case([2, 1], "rotated by one")
    yield _case([3, 4, 5, 1, 2], "rotated by three")
    yield _case([-(10**9), 10**9], "the extremes of the stated range, unrotated")
    yield _case([10**9, -(10**9)], "the extremes, rotated")

    for n in (4, 11, 50, 200):
        yield _case(_rotated(rng, n, 0, spread=1000))
        yield _case(_rotated(rng, n, rng.randrange(n), spread=1000))
        yield _case(_rotated(rng, n, n - 1, spread=1000))

    for _ in range(2):
        n = rng.randint(1000, 5000)
        yield _case(_rotated(rng, n, rng.randrange(n)))

    n = 10**5
    yield _case(_rotated(rng, n, rng.randrange(1, n)), "the stated maximum, rotated")
