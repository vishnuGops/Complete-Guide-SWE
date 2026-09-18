"""Random inputs for remove-duplicates.

Chains are built sorted from small pools so that runs happen constantly. The
shapes that matter: a run at the head, a run at the tail, a chain that is one
long run, and a chain with no repeats at all.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], "the empty chain")
    yield _case([1], "a single link, kept")
    yield _case([1, 1], "a single run, removed entirely")
    yield _case([1, 1, 1, 2, 3], "a run at the head")
    yield _case([1, 2, 3, 3], "a run at the tail")
    yield _case([1, 2, 3], "no repeats at all")
    yield _case([-(10**9), -(10**9), 10**9], "the extremes of the stated range")

    for n, pool in ((6, 4), (20, 8), (60, 12), (200, 30)):
        yield _case(sorted(rng.randint(0, pool) for _ in range(n)))

    yield _case([5] * 300, "one run of three hundred")
    yield _case(sorted(rng.sample(range(10**6), 500)), "five hundred distinct values")

    for _ in range(2):
        n = rng.randint(500, 2000)
        yield _case(sorted(rng.randint(0, n // 4) for _ in range(n)))

    yield _case(
        sorted(rng.randint(0, 3000) for _ in range(10**4)),
        "the stated maximum, with runs throughout",
    )
