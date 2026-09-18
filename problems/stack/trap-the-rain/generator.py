"""Random inputs for trap-the-rain.

Random heights hold very little water, so most cases are built as valleys: a
descent, a flat floor and a climb. The degenerate rows - empty, one column,
monotone in either direction - all hold nothing and are where the loop
conditions are tested.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(heights: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [heights]}
    if name:
        case["name"] = name
    return case


def _valley(rng: random.Random, n: int, high: int) -> List[int]:
    """A row that mostly descends and then mostly climbs."""
    middle = rng.randrange(1, n) if n > 1 else 0
    out = []
    level = rng.randint(high // 2, high)
    for i in range(n):
        if i < middle:
            level = max(0, level - rng.randint(0, 3))
        else:
            level = min(high, level + rng.randint(0, 3))
        out.append(level + rng.randint(0, 2))
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], "an empty row")
    yield _case([5], "a single column")
    yield _case([5, 3], "two columns hold nothing")
    yield _case([2, 0, 2], "one dip")
    yield _case([3, 2, 1], "a row that only falls")
    yield _case([1, 2, 3], "a row that only rises")
    yield _case([0, 0, 0, 0], "no height anywhere")
    yield _case([10**4, 0, 10**4], "the extremes of the stated height range")
    yield _case([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1], "the worked example")

    for n, high in ((5, 5), (20, 10), (90, 30), (400, 8)):
        yield _case(_valley(rng, n, high))
        yield _case([rng.randint(0, high) for _ in range(n)])

    for _ in range(2):
        n = rng.randint(500, 2000)
        yield _case(_valley(rng, n, 10**4))

    n = 10**4
    yield _case(_valley(rng, n, 10**4), "the stated maximum, as a valley")
    yield _case(
        [rng.randint(0, 10**4) for _ in range(n)],
        "the stated maximum, where recomputing the maxima cannot finish",
    )
