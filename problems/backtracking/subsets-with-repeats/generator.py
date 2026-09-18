"""Random inputs for subsets-with-repeats.

Values are drawn from tiny pools so that runs of equal values are the norm - a
row of distinct values exercises none of what this problem is about. Rows of a
single repeated value and rows with no repeats at all bracket the range.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([0], "one value")
    yield _case([1, 1], "two equal values")
    yield _case([1, 2], "two different values")
    yield _case([1, 2, 2], "one value repeated")
    yield _case([4, 4, 4], "every value the same")
    yield _case([2, 1, 2], "the repeats are not adjacent to begin with")
    yield _case([-10, 10], "the extremes of the stated range")
    yield _case([-1, -1, 0, 0], "negatives and zeroes, both repeated")

    for n, pool in ((3, 2), (4, 2), (5, 3), (6, 3), (7, 4), (8, 2)):
        yield _case([rng.randint(-2, pool) for _ in range(n)])

    yield _case(list(range(10)), "ten distinct values, where nothing is skipped")
    yield _case([7] * 10, "the stated maximum, all the same")
    yield _case([rng.randint(-3, 3) for _ in range(10)], "the stated maximum")
    yield _case([rng.choice([-10, 10]) for _ in range(10)], "the stated maximum over two values")
