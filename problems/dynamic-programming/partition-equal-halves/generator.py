"""Random inputs for partition-equal-halves.

Half the rows are built splittable by construction - two groups of equal total,
shuffled together - and the rest are random, most of which are not. Odd totals
appear often, since they are settled before the table is built.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def _splittable(rng: random.Random, half_count: int, high: int) -> List[int]:
    left = [rng.randint(1, high) for _ in range(half_count)]
    target = sum(left)
    right: List[int] = []
    remaining = target
    while remaining > 0:
        take = min(remaining, rng.randint(1, high))
        right.append(take)
        remaining -= take
    values = left + right
    rng.shuffle(values)
    return values


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], "one value, which cannot be split")
    yield _case([2, 2], "two equal values")
    yield _case([1, 1, 1], "three ones, an odd total")
    yield _case([1, 5, 11, 5], "an even split of four values")
    yield _case([1, 2, 3, 5], "an odd total")
    yield _case([100, 100], "the extremes of the stated range")
    yield _case([1, 1, 1, 1], "four ones")
    yield _case([3, 3, 3, 4, 5], "an even total that still cannot be split")

    for n, high in ((4, 10), (8, 20), (20, 50), (60, 100)):
        yield _case(_splittable(rng, n // 2, high))
        yield _case([rng.randint(1, high) for _ in range(n)])

    yield _case([1] * 199, "one hundred and ninety-nine ones, an odd total")
    yield _case([1] * 200, "two hundred ones")
    yield _case(_splittable(rng, 100, 100), "the stated maxima, splittable")
    yield _case([rng.randint(1, 100) for _ in range(200)], "the stated maxima")
