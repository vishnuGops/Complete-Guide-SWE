"""Random inputs for reverse-chain.

A chain is written as the list of its values. The shapes that matter here are
the short ones - empty, one link, two links - because that is where the null
handling either works or does not.
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
    yield _case([1], "a single link")
    yield _case([1, 2], "two links")
    yield _case([7, 7, 7], "every value the same")
    yield _case([-(10**9), 10**9], "the extremes of the stated range")

    for n in (3, 8, 40, 300):
        yield _case([rng.randint(-1000, 1000) for _ in range(n)])

    for _ in range(3):
        n = rng.randint(500, 2000)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)])

    yield _case([rng.randint(-(10**9), 10**9) for _ in range(10**4)], "the stated maximum")
