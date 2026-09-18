"""Random inputs for median-of-two-sorted.

The shapes that matter: one series empty, series that do not overlap at all (the
cut takes none or all of the shorter one), heavy duplicates, wildly different
lengths, and both parities of the combined total.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(first: List[int], second: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [first, second]}
    if name:
        case["name"] = name
    return case


def _sorted_row(rng: random.Random, n: int, low: int, high: int) -> List[int]:
    return sorted(rng.randint(low, high) for _ in range(n))


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], [7], "the first series is empty")
    yield _case([7], [], "the second series is empty")
    yield _case([1, 3], [2], "an odd total")
    yield _case([1, 2], [3, 4], "an even total")
    yield _case([1, 2, 3], [10, 11, 12], "the series do not overlap")
    yield _case([-(10**6)], [10**6], "the extremes of the stated range")
    yield _case([2, 2, 2, 2], [2, 2], "every reading the same")

    for n, m in ((1, 9), (9, 1), (5, 5), (4, 7), (30, 31)):
        yield _case(_sorted_row(rng, n, -50, 50), _sorted_row(rng, m, -50, 50))

    # Very different lengths, so the search really does run over the shorter.
    yield _case(_sorted_row(rng, 3, -1000, 1000), _sorted_row(rng, 2000, -1000, 1000), "three against two thousand")

    for _ in range(2):
        n = rng.randint(100, 1500)
        m = rng.randint(100, 1500)
        yield _case(_sorted_row(rng, n, -(10**6), 10**6), _sorted_row(rng, m, -(10**6), 10**6))

    yield _case(
        _sorted_row(rng, 10**4, -(10**6), 10**6),
        _sorted_row(rng, 10**4, -(10**6), 10**6),
        "the stated maximum on both sides",
    )
