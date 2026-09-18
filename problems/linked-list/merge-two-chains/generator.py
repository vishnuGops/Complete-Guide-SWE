"""Random inputs for merge-two-chains.

Both chains are built sorted. The shapes that matter: either chain empty, chains
that do not interleave at all (so the remainder line does most of the work),
heavy duplicates, and very different lengths.
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
    yield _case([], [], "both chains empty")
    yield _case([], [0], "the first chain is empty")
    yield _case([0], [], "the second chain is empty")
    yield _case([1, 2, 3], [4, 5, 6], "the chains do not interleave")
    yield _case([2, 2, 2], [2, 2], "every value the same")
    yield _case([-(10**9)], [10**9], "the extremes of the stated range")

    for n, m in ((1, 5), (5, 1), (4, 4), (11, 13)):
        yield _case(_sorted_row(rng, n, -50, 50), _sorted_row(rng, m, -50, 50))

    yield _case(_sorted_row(rng, 2, -10, 10), _sorted_row(rng, 2000, -10, 10), "two against two thousand")

    for _ in range(2):
        n = rng.randint(200, 900)
        m = rng.randint(200, 900)
        yield _case(_sorted_row(rng, n, -(10**9), 10**9), _sorted_row(rng, m, -(10**9), 10**9))

    yield _case(
        _sorted_row(rng, 10**4, -(10**9), 10**9),
        _sorted_row(rng, 10**4, -(10**9), 10**9),
        "the stated maximum on both sides",
    )
