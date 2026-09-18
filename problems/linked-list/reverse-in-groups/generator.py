"""Random inputs for reverse-in-groups.

The interesting variation is how the chain's length sits against `k`: an exact
multiple (no leftover), one more than a multiple (a leftover of one), k larger
than the whole chain (nothing moves), and k = 1.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], k: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values, k]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], 3, "the empty chain")
    yield _case([1], 1, "one link, groups of one")
    yield _case([1], 2, "one link, k larger than the chain")
    yield _case([1, 2, 3], 1, "groups of one change nothing")
    yield _case([1, 2, 3, 4], 4, "one group, exactly")
    yield _case([1, 2, 3, 4, 5], 2, "a leftover of one")
    yield _case([-(10**9), 10**9], 2, "the extremes of the stated range")

    for n in (6, 7, 12, 50):
        values = [rng.randint(-1000, 1000) for _ in range(n)]
        for k in (2, 3, n, n + 1):
            yield _case(list(values), k)

    for _ in range(2):
        n = rng.randint(500, 2000)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)], rng.randint(2, 40))

    n = 10**4
    values = [rng.randint(-(10**9), 10**9) for _ in range(n)]
    yield _case(list(values), 3, "the stated maximum, groups of three")
    yield _case(list(values), n, "the stated maximum as a single group")
